import type { GeoProjection } from "d3-geo";

// Mesh-based raster reprojection. Rather than invert every output pixel in a
// per-projection GLSL shader, we invert a coarse screen grid on the CPU (a few
// thousand `projection.invert` calls, cheap even for numeric inverses like
// Winkel Tripel) and let the GPU bilinearly interpolate an equirectangular
// texture across the resulting triangles. Works for all 8 projections with one
// code path. The equirectangular source makes (lon,lat)→uv linear:
//   u = (lon+180)/360 , v = (90-lat)/180.

export type TextureId = "satellite" | "terrain";

const TEXTURE_URLS: Record<TextureId, string> = {
  satellite: `${import.meta.env.BASE_URL}textures/satellite.jpg`,
  terrain: `${import.meta.env.BASE_URL}textures/terrain.jpg`,
};

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
void main() {
  frag = texture(u_tex, v_uv);
}`;

interface TexEntry {
  tex: WebGLTexture;
  loaded: boolean;
  loading: boolean;
}

export class RasterWarper {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null;
  private program: WebGLProgram | null = null;
  private vbo: WebGLBuffer | null = null;
  private aPos = 0;
  private aUv = 0;
  private textures = new Map<TextureId, TexEntry>();
  private verts = new Float32Array(0);
  /** Called when a texture finishes loading, so the host can redraw. */
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
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("RasterWarper: program link failed", gl.getProgramInfoLog(prog));
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

  /** Kick off async load (idempotent). Returns true once ready to sample. */
  ensureTexture(id: TextureId): boolean {
    const gl = this.gl;
    if (!gl) return false;
    let entry = this.textures.get(id);
    if (entry?.loaded) return true;
    if (entry?.loading) return false;

    const tex = gl.createTexture()!;
    entry = { tex, loaded: false, loading: true };
    this.textures.set(id, entry);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      // WebGL2 allows REPEAT + mipmaps on non-power-of-two textures.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR,
      );
      gl.generateMipmap(gl.TEXTURE_2D);
      entry!.loaded = true;
      entry!.loading = false;
      this.onTextureLoad?.();
    };
    img.onerror = () => {
      entry!.loading = false;
      console.warn("RasterWarper: failed to load", TEXTURE_URLS[id]);
    };
    img.src = TEXTURE_URLS[id];
    return false;
  }

  /**
   * Warp `id` into the current projection and draw into this.canvas. Returns
   * false if GL is unsupported or the texture isn't ready yet (caller should
   * fall back to a flat fill until onTextureLoad fires).
   */
  render(
    projection: GeoProjection,
    width: number,
    height: number,
    gridCols: number,
    id: TextureId,
  ): boolean {
    const gl = this.gl;
    if (!gl || !this.program) return false;
    if (!this.ensureTexture(id)) return false;
    const entry = this.textures.get(id)!;

    const cols = Math.max(4, Math.round(gridCols));
    const rows = Math.max(2, Math.round((cols * height) / width));
    const nodeU = new Float32Array((cols + 1) * (rows + 1));
    const nodeV = new Float32Array((cols + 1) * (rows + 1));
    const nodeX = new Float32Array((cols + 1) * (rows + 1));
    const nodeY = new Float32Array((cols + 1) * (rows + 1));
    const valid = new Uint8Array((cols + 1) * (rows + 1));

    const idx = (i: number, j: number) => j * (cols + 1) + i;
    for (let j = 0; j <= rows; j++) {
      const yCss = (j / rows) * height;
      for (let i = 0; i <= cols; i++) {
        const xCss = (i / cols) * width;
        const ll = projection.invert?.([xCss, yCss]);
        const k = idx(i, j);
        if (ll && Number.isFinite(ll[0]) && Number.isFinite(ll[1])) {
          nodeX[k] = (xCss / width) * 2 - 1;
          nodeY[k] = 1 - (yCss / height) * 2;
          nodeU[k] = (ll[0] + 180) / 360;
          nodeV[k] = (90 - ll[1]) / 180;
          valid[k] = 1;
        }
      }
    }

    // Emit 2 triangles per fully-valid cell (6 verts × 4 floats).
    const maxVerts = cols * rows * 6 * 4;
    if (this.verts.length < maxVerts) this.verts = new Float32Array(maxVerts);
    const buf = this.verts;
    let n = 0;
    const push = (k: number, u: number) => {
      buf[n++] = nodeX[k];
      buf[n++] = nodeY[k];
      buf[n++] = u;
      buf[n++] = nodeV[k];
    };
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = idx(i, j);
        const b = idx(i + 1, j);
        const c = idx(i, j + 1);
        const d = idx(i + 1, j + 1);
        if (!(valid[a] && valid[b] && valid[c] && valid[d])) continue;
        // Unwrap the antimeridian seam within a cell: if the four u's straddle
        // the 0/1 boundary, lift the small ones by 1 (REPEAT wrap samples ok).
        let ua = nodeU[a];
        let ub = nodeU[b];
        let uc = nodeU[c];
        let ud = nodeU[d];
        const mn = Math.min(ua, ub, uc, ud);
        const mx = Math.max(ua, ub, uc, ud);
        if (mx - mn > 0.5) {
          if (ua < 0.5) ua += 1;
          if (ub < 0.5) ub += 1;
          if (uc < 0.5) uc += 1;
          if (ud < 0.5) ud += 1;
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
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (n === 0) return true;

    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, n), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(this.aUv);
    gl.vertexAttribPointer(this.aUv, 2, gl.FLOAT, false, 16, 8);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, entry.tex);
    gl.uniform1i(gl.getUniformLocation(this.program, "u_tex"), 0);
    gl.drawArrays(gl.TRIANGLES, 0, n / 4);
    return true;
  }

  dispose() {
    const gl = this.gl;
    if (!gl) return;
    for (const e of this.textures.values()) gl.deleteTexture(e.tex);
    if (this.vbo) gl.deleteBuffer(this.vbo);
    if (this.program) gl.deleteProgram(this.program);
    this.textures.clear();
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
