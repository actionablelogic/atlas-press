import type { GeoProjection } from "d3-geo";

// Generic WebGL2 mesh-based raster reprojection. Invert a coarse screen grid on
// the CPU and let the GPU bilinearly interpolate a texture across the resulting
// triangles. The texture + the (lon,lat)→uv mapping are supplied by the caller,
// so the same warper serves both equirectangular world imagery (M4a) and
// dynamically-assembled Web-Mercator tile mosaics (M4b).

export type TextureId = "satellite" | "terrain";

const TEXTURE_URLS: Record<TextureId, string> = {
  satellite: `${import.meta.env.BASE_URL}textures/satellite.jpg`,
  terrain: `${import.meta.env.BASE_URL}textures/terrain.jpg`,
};

/** (lon,lat) → texture uv, or null to drop the sample (off-texture). */
export type UvFn = (lon: number, lat: number) => [number, number] | null;

export const equirectUv: UvFn = (lon, lat) => [
  (lon + 180) / 360,
  (90 - lat) / 180,
];

const VERT = `#version 300 es
in vec2 a_pos;
in vec2 a_uv;
out vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
out vec4 frag;
void main() { frag = texture(u_tex, v_uv); }`;

interface EquirectEntry {
  tex: WebGLTexture;
  loaded: boolean;
  loading: boolean;
}

export interface DrawMeshOptions {
  /** Equirectangular textures wrap in longitude → unwrap the antimeridian seam
   *  per cell. Mercator mosaics don't wrap; off-[0,1] cells are culled instead. */
  wrap: boolean;
  /** Clear the canvas before drawing (false = composite on top of a prior pass). */
  clear: boolean;
}

export class RasterWarper {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null;
  private program: WebGLProgram | null = null;
  private vbo: WebGLBuffer | null = null;
  private aPos = 0;
  private aUv = 0;
  private equirect = new Map<TextureId, EquirectEntry>();
  private verts = new Float32Array(0);
  /** Called when an equirect texture finishes loading, so the host can redraw. */
  onTextureLoad: (() => void) | null = null;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.gl = this.canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    });
    if (this.gl) this.init(this.gl);
  }

  get supported(): boolean {
    return this.gl != null && this.program != null;
  }

  private init(gl: WebGL2RenderingContext) {
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("RasterWarper: link failed", gl.getProgramInfoLog(prog));
      return;
    }
    this.program = prog;
    this.aPos = gl.getAttribLocation(prog, "a_pos");
    this.aUv = gl.getAttribLocation(prog, "a_uv");
    this.vbo = gl.createBuffer();
    gl.clearColor(0, 0, 0, 0);
  }

  setSize(width: number, height: number, dpr: number) {
    const w = Math.max(1, Math.round(width * dpr));
    const h = Math.max(1, Math.round(height * dpr));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
  }

  // --- texture helpers (used by the Mercator mosaic) -------------------
  createTexture(): WebGLTexture | null {
    return this.gl?.createTexture() ?? null;
  }

  deleteTexture(tex: WebGLTexture | null) {
    if (tex) this.gl?.deleteTexture(tex);
  }

  uploadTexture(tex: WebGLTexture, source: TexImageSource, repeat: boolean) {
    const gl = this.gl;
    if (!gl) return;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  /** Lazy-load a bundled equirectangular texture; null until ready. */
  ensureEquirect(id: TextureId): WebGLTexture | null {
    const gl = this.gl;
    if (!gl) return null;
    const entry = this.equirect.get(id);
    if (entry?.loaded) return entry.tex;
    if (entry?.loading) return null;

    const tex = gl.createTexture()!;
    const e: EquirectEntry = { tex, loaded: false, loading: true };
    this.equirect.set(id, e);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      this.uploadTexture(tex, img, true);
      e.loaded = true;
      e.loading = false;
      this.onTextureLoad?.();
    };
    img.onerror = () => {
      e.loading = false;
      console.warn("RasterWarper: failed to load", TEXTURE_URLS[id]);
    };
    img.src = TEXTURE_URLS[id];
    return null;
  }

  /** Await an equirect texture (for export, which can't skip a frame). */
  loadEquirect(id: TextureId): Promise<WebGLTexture | null> {
    const tex = this.ensureEquirect(id);
    if (tex) return Promise.resolve(tex);
    return new Promise((resolve) => {
      const prev = this.onTextureLoad;
      this.onTextureLoad = () => {
        prev?.();
        const t = this.ensureEquirect(id);
        if (t) {
          this.onTextureLoad = prev;
          resolve(t);
        }
      };
      setTimeout(() => resolve(this.ensureEquirect(id)), 20000);
    });
  }

  /**
   * Warp `tex` into `projection` using `uvFn`, drawing into this.canvas.
   * Returns false if GL is unavailable.
   */
  drawMesh(
    projection: GeoProjection,
    width: number,
    height: number,
    gridCols: number,
    tex: WebGLTexture,
    uvFn: UvFn,
    opts: DrawMeshOptions,
  ): boolean {
    const gl = this.gl;
    if (!gl || !this.program) return false;

    const cols = Math.max(4, Math.round(gridCols));
    const rows = Math.max(2, Math.round((cols * height) / width));
    const N = (cols + 1) * (rows + 1);
    const nx = new Float32Array(N); // clip x
    const ny = new Float32Array(N); // clip y
    const nu = new Float32Array(N);
    const nv = new Float32Array(N);
    const ok = new Uint8Array(N);

    const at = (i: number, j: number) => j * (cols + 1) + i;
    for (let j = 0; j <= rows; j++) {
      const yCss = (j / rows) * height;
      for (let i = 0; i <= cols; i++) {
        const xCss = (i / cols) * width;
        const ll = projection.invert?.([xCss, yCss]);
        const k = at(i, j);
        if (!ll || !Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) continue;
        const uv = uvFn(ll[0], ll[1]);
        if (!uv) continue;
        nx[k] = (xCss / width) * 2 - 1;
        ny[k] = 1 - (yCss / height) * 2;
        nu[k] = uv[0];
        nv[k] = uv[1];
        ok[k] = 1;
      }
    }

    const maxVerts = cols * rows * 6 * 4;
    if (this.verts.length < maxVerts) this.verts = new Float32Array(maxVerts);
    const buf = this.verts;
    let n = 0;
    const push = (k: number, u: number) => {
      buf[n++] = nx[k];
      buf[n++] = ny[k];
      buf[n++] = u;
      buf[n++] = nv[k];
    };
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = at(i, j);
        const b = at(i + 1, j);
        const c = at(i, j + 1);
        const d = at(i + 1, j + 1);
        if (!(ok[a] && ok[b] && ok[c] && ok[d])) continue;
        let ua = nu[a];
        let ub = nu[b];
        let uc = nu[c];
        let ud = nu[d];
        if (opts.wrap) {
          const mn = Math.min(ua, ub, uc, ud);
          const mx = Math.max(ua, ub, uc, ud);
          if (mx - mn > 0.5) {
            if (ua < 0.5) ua += 1;
            if (ub < 0.5) ub += 1;
            if (uc < 0.5) uc += 1;
            if (ud < 0.5) ud += 1;
          }
        } else {
          // Cull cells that fall outside the mosaic (BM/ocean shows instead).
          const us = [ua, ub, uc, ud];
          const vs = [nv[a], nv[b], nv[c], nv[d]];
          if (Math.min(...us) < -0.002 || Math.max(...us) > 1.002) continue;
          if (Math.min(...vs) < -0.002 || Math.max(...vs) > 1.002) continue;
        }
        push(a, ua);
        push(b, ub);
        push(c, uc);
        push(c, uc);
        push(b, ub);
        push(d, ud);
      }
    }

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    if (opts.clear) gl.clear(gl.COLOR_BUFFER_BIT);
    if (n === 0) return true;

    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, n), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(this.aUv);
    gl.vertexAttribPointer(this.aUv, 2, gl.FLOAT, false, 16, 8);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(this.program, "u_tex"), 0);
    gl.drawArrays(gl.TRIANGLES, 0, n / 4);
    return true;
  }

  dispose() {
    const gl = this.gl;
    if (!gl) return;
    for (const e of this.equirect.values()) gl.deleteTexture(e.tex);
    if (this.vbo) gl.deleteBuffer(this.vbo);
    if (this.program) gl.deleteProgram(this.program);
    this.equirect.clear();
  }
}

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader | null {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn("RasterWarper: shader compile failed", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}
