import { getProjectionDef, type ProjectionId } from "../geo/projections";
import { getWorld } from "../geo/data";
import type { View } from "../geo/view";
import type { StyleDef } from "../styles/styles";
import type { Overlay } from "../overlays/types";
import { renderMap } from "../render/renderMap";
import { drawOverlays } from "../render/drawOverlays";
import { RasterWarper, equirectUv } from "../render/RasterWarper";
import { MercatorMosaic, visibleBbox } from "../render/MercatorMosaic";
import { TILE_SOURCES_BY_ID } from "../render/tileSources";
import type { TileConfig } from "../components/MapCanvas";
import { createPngStream, prefixRows } from "./pngStream";
import type { ExportDims } from "./sizes";

const STRIP = 1024;
const BM_TEXTURE_WIDTH = 5400;

export type ExportFormat = "png" | "jpeg";

export interface ExportRequest {
  projectionId: ProjectionId;
  view: View;
  style: StyleDef;
  tileConfig: TileConfig;
  showGraticuleLabels: boolean;
  overlays: Overlay[];
  footer: string | null;
  previewW: number;
  previewH: number;
  dims: ExportDims;
  format: ExportFormat;
  onProgress?: (fraction: number) => void;
}

function projAt(id: ProjectionId, view: View, scale: number, ty: number) {
  return getProjectionDef(id)
    .factory()
    .rotate(view.rotation)
    .scale(view.scale * scale)
    .translate([view.translate[0] * scale, view.translate[1] * scale - ty]);
}

export async function renderExport(req: ExportRequest): Promise<Blob> {
  const { dims, previewW, style, projectionId, view, format } = req;
  const k = dims.width / previewW;
  const grid = Math.max(64, Math.round(dims.width / 40));
  const world = getWorld("50m");
  const capability = getProjectionDef(projectionId).capability;

  // --- raster preparation (equirect load / tile mosaic at export scale) ---
  let warper: RasterWarper | null = null;
  let mosaic: MercatorMosaic | null = null;
  let rasterMode: "terrain" | "sat-world" | "sat-tiles" | "basemap" | null = null;
  const rasterLayer = style.layers.find((l) => l.type === "raster");
  if (rasterLayer) {
    warper = new RasterWarper();
    if (warper.supported) {
      if (rasterLayer.basemap) {
        const source = TILE_SOURCES_BY_ID[rasterLayer.basemap];
        const full = projAt(projectionId, view, k, 0);
        const bbox = visibleBbox(full, dims.width, dims.height);
        if (source && bbox) {
          mosaic = new MercatorMosaic(warper);
          await mosaic.assemble(full, dims.width, dims.height, { source });
          rasterMode = "basemap";
        }
        // else: world-wide → no tiles; the vector base layers render.
      } else if (rasterLayer.texture === "terrain") {
        await warper.loadEquirect("terrain");
        rasterMode = "terrain";
      } else {
        await warper.loadEquirect("satellite");
        const full = projAt(projectionId, view, k, 0);
        const bbox = visibleBbox(full, dims.width, dims.height);
        const source = TILE_SOURCES_BY_ID[req.tileConfig.sourceId];
        const useTiles =
          !!bbox &&
          !!source &&
          ((bbox.maxLon - bbox.minLon) / 360) * BM_TEXTURE_WIDTH < dims.width * 0.9;
        if (useTiles) {
          mosaic = new MercatorMosaic(warper);
          await mosaic.assemble(full, dims.width, dims.height, {
            source,
            apiKey: req.tileConfig.apiKey,
            customTemplate: req.tileConfig.customTemplate,
          });
          rasterMode = "sat-tiles";
        } else {
          rasterMode = "sat-world";
        }
      }
    }
  }

  const renderRaster = (
    _layer: unknown,
    projection: ReturnType<typeof projAt>,
    width: number,
    height: number,
  ): HTMLCanvasElement | null => {
    if (!warper?.supported) return null;
    if (rasterMode === "basemap") {
      const mt = mosaic?.texture;
      if (!mt) return null;
      warper.drawMesh(projection, width, height, grid, mt, mosaic!.uvFn, { wrap: false, clear: true });
      return warper.commit();
    }
    if (rasterMode === "terrain") {
      const t = warper.ensureEquirect("terrain");
      if (!t) return null;
      warper.drawMesh(projection, width, height, grid, t, equirectUv, { wrap: true, clear: true });
      return warper.commit();
    }
    const bm = warper.ensureEquirect("satellite");
    if (rasterMode === "sat-world") {
      if (!bm) return null;
      warper.drawMesh(projection, width, height, grid, bm, equirectUv, { wrap: true, clear: true });
      return warper.commit();
    }
    // sat-tiles
    let base = false;
    if (bm) {
      warper.drawMesh(projection, width, height, grid, bm, equirectUv, { wrap: true, clear: true });
      base = true;
    }
    const mt = mosaic?.texture;
    if (mt) {
      warper.drawMesh(projection, width, height, grid, mt, mosaic!.uvFn, { wrap: false, clear: !base });
    }
    return base || mt ? warper.commit() : null;
  };

  // --- strip render ---
  const strip = document.createElement("canvas");
  strip.width = dims.width;
  const png = format === "png" ? createPngStream(dims.width, dims.height) : null;
  let big: HTMLCanvasElement | null = null;
  let bigCtx: CanvasRenderingContext2D | null = null;
  if (format === "jpeg") {
    big = document.createElement("canvas");
    big.width = dims.width;
    big.height = dims.height;
    bigCtx = big.getContext("2d");
  }

  for (let y0 = 0; y0 < dims.height; y0 += STRIP) {
    const sh = Math.min(STRIP, dims.height - y0);
    strip.height = sh;
    const ctx = strip.getContext("2d", { willReadFrequently: format === "png" })!;
    warper?.setSize(dims.width, sh, 1);
    const projection = projAt(projectionId, view, k, y0);
    renderMap(ctx, {
      projection,
      world,
      style,
      capability,
      width: dims.width,
      height: sh,
      pixelRatio: 1,
      renderScale: k,
      showLabels: true,
      showGraticuleLabels: req.showGraticuleLabels,
      renderRaster: renderRaster as never,
    });
    ctx.save();
    ctx.translate(0, -y0);
    drawOverlays(ctx, req.overlays, dims.width, dims.height);
    if (req.footer) drawFooter(ctx, req.footer, dims.width, dims.height, k);
    ctx.restore();

    if (png) {
      const img = ctx.getImageData(0, 0, dims.width, sh);
      png.addRows(prefixRows(img.data, dims.width, sh));
    } else {
      bigCtx!.drawImage(strip, 0, y0);
    }
    req.onProgress?.(Math.min(1, (y0 + sh) / dims.height));
    await new Promise((r) => setTimeout(r, 0)); // keep UI responsive
  }

  mosaic?.dispose();
  warper?.dispose();

  if (png) return png.finish();
  return await new Promise<Blob>((resolve, reject) =>
    big!.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.9),
  );
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  text: string,
  W: number,
  H: number,
  k: number,
): void {
  ctx.save();
  ctx.font = `${11 * k}px 'EB Garamond', Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "rgba(60,54,44,0.7)";
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 3 * k;
  ctx.lineJoin = "round";
  ctx.strokeText(text, W / 2, H - 10 * k);
  ctx.fillText(text, W / 2, H - 10 * k);
  ctx.restore();
}
