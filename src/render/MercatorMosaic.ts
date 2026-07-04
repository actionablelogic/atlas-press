import type { GeoProjection } from "d3-geo";
import { lonLatToTile, MERCATOR_MAX_LAT } from "../geo/mercator";
import { getTile } from "./tileCache";
import { tileUrl, type TileSource } from "./tileSources";
import type { RasterWarper, UvFn } from "./RasterWarper";

const MAX_TILES = 144; // per-view fetch budget
const MAX_MOSAIC_PX = 4096; // texture dimension cap
const QUALITY = 1.4; // mosaic px per canvas px at the region

export interface Bbox {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

/** Visible geographic extent, by inverting a coarse screen grid. null if the
 *  view shows too little or wraps the antimeridian (mercator unsuitable). */
export function visibleBbox(
  projection: GeoProjection,
  width: number,
  height: number,
): Bbox | null {
  const G = 10;
  let minLon = Infinity,
    maxLon = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity,
    count = 0;
  for (let j = 0; j <= G; j++) {
    for (let i = 0; i <= G; i++) {
      const ll = projection.invert?.([(i / G) * width, (j / G) * height]);
      if (!ll || !Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) continue;
      count++;
      minLon = Math.min(minLon, ll[0]);
      maxLon = Math.max(maxLon, ll[0]);
      minLat = Math.min(minLat, ll[1]);
      maxLat = Math.max(maxLat, ll[1]);
    }
  }
  if (count < 4 || maxLon - minLon > 170) return null;
  minLat = Math.max(minLat, -MERCATOR_MAX_LAT);
  maxLat = Math.min(maxLat, MERCATOR_MAX_LAT);
  if (maxLat <= minLat) return null;
  return { minLon, maxLon, minLat, maxLat };
}

export interface MosaicRequest {
  source: TileSource;
  apiKey?: string;
  customTemplate?: string;
}

interface Plan {
  z: number;
  tx0: number;
  ty0: number;
  nx: number;
  ny: number;
}

export class MercatorMosaic {
  private warper: RasterWarper;
  private tex: WebGLTexture | null = null;
  private assembleCanvas: HTMLCanvasElement;
  private plan: Plan | null = null;
  private key = "";
  private abort: AbortController | null = null;
  onReady: (() => void) | null = null;

  constructor(warper: RasterWarper) {
    this.warper = warper;
    this.assembleCanvas = document.createElement("canvas");
  }

  /** The mosaic texture, or null if none has been assembled yet. */
  get texture(): WebGLTexture | null {
    return this.plan ? this.tex : null;
  }

  private makePlan(bbox: Bbox, width: number, source: TileSource): Plan | null {
    const dxFrac = (bbox.maxLon - bbox.minLon) / 360;
    if (dxFrac <= 0) return null;
    let z = Math.round(Math.log2((width * QUALITY) / (dxFrac * 256)));
    z = Math.max(source.minZoom + 1, Math.min(source.maxZoom, z));
    for (; z >= 1; z--) {
      const [ax, ay] = lonLatToTile(bbox.minLon, bbox.maxLat, z);
      const [bx, by] = lonLatToTile(bbox.maxLon, bbox.minLat, z);
      const tx0 = Math.floor(Math.min(ax, bx));
      const tx1 = Math.floor(Math.max(ax, bx));
      const ty0 = Math.floor(Math.min(ay, by));
      const ty1 = Math.floor(Math.max(ay, by));
      const nx = tx1 - tx0 + 1;
      const ny = ty1 - ty0 + 1;
      if (nx * ny <= MAX_TILES && nx * 256 <= MAX_MOSAIC_PX && ny * 256 <= MAX_MOSAIC_PX) {
        return { z, tx0, ty0, nx, ny };
      }
    }
    return null;
  }

  /**
   * Refresh the mosaic for the current view. Call on idle (not mid-drag).
   * Returns true if mercator is suitable for this view (false → use Blue Marble).
   */
  update(
    projection: GeoProjection,
    width: number,
    height: number,
    req: MosaicRequest,
  ): boolean {
    if (!this.warper.supported) return false;
    const bbox = visibleBbox(projection, width, height);
    if (!bbox) return false;
    const plan = this.makePlan(bbox, width, req.source);
    if (!plan) return false;

    const sig = `${req.source.id}|${req.customTemplate ?? ""}|${plan.z}|${plan.tx0}|${plan.ty0}|${plan.nx}|${plan.ny}`;
    if (sig === this.key) return true; // already assembled/assembling this view
    this.key = sig;

    this.abort?.abort();
    this.abort = new AbortController();
    const signal = this.abort.signal;

    const { z, tx0, ty0, nx, ny } = plan;
    const cv = this.assembleCanvas;
    cv.width = nx * 256;
    cv.height = ny * 256;
    const ctx = cv.getContext("2d");
    if (!ctx) return false;
    ctx.clearRect(0, 0, cv.width, cv.height);

    const total = nx * ny;
    const span = 2 ** z;
    let done = 0;
    for (let ty = ty0; ty < ty0 + ny; ty++) {
      for (let tx = tx0; tx < tx0 + nx; tx++) {
        const wx = ((tx % span) + span) % span;
        const wy = ((ty % span) + span) % span;
        const url = tileUrl(req.source, z, wx, wy, req.apiKey, req.customTemplate);
        const cacheKey = `${req.source.id}/${z}/${wx}/${wy}`;
        getTile(cacheKey, url, signal).then((bmp) => {
          done++;
          if (!signal.aborted && bmp) {
            ctx.drawImage(bmp, (tx - tx0) * 256, (ty - ty0) * 256);
            bmp.close?.();
          }
          if (done >= total && !signal.aborted) {
            if (!this.tex) this.tex = this.warper.createTexture();
            if (this.tex) {
              this.warper.uploadTexture(this.tex, cv, false);
              this.plan = { z, tx0, ty0, nx, ny };
              this.onReady?.();
            }
          }
        });
      }
    }
    return true;
  }

  /** Assemble the mosaic and resolve once its texture is ready (for export). */
  assemble(
    projection: GeoProjection,
    width: number,
    height: number,
    req: MosaicRequest,
  ): Promise<boolean> {
    const suitable = this.update(projection, width, height, req);
    if (!suitable) return Promise.resolve(false);
    if (this.texture) return Promise.resolve(true);
    return new Promise((resolve) => {
      this.onReady = () => resolve(this.texture != null);
      setTimeout(() => resolve(this.texture != null), 30000);
    });
  }

  uvFn: UvFn = (lon, lat) => {
    const m = this.plan;
    if (!m || lat > MERCATOR_MAX_LAT || lat < -MERCATOR_MAX_LAT) return null;
    const [fx, fy] = lonLatToTile(lon, lat, m.z);
    return [(fx - m.tx0) / m.nx, (fy - m.ty0) / m.ny];
  };

  dispose() {
    this.abort?.abort();
    this.warper.deleteTexture(this.tex);
    this.tex = null;
    this.plan = null;
  }
}
