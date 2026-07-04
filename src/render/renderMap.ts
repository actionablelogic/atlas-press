import { geoGraticule, geoPath, type GeoProjection } from "d3-geo";
import type { Feature } from "geojson";
import type { WorldData } from "../geo/data";
import type { ProjectionCapability } from "../geo/projections";
import { lakes, rivers } from "../data/physical";
import { getRoadsSync } from "../data/roads";
import type { LayerSpec, StyleDef } from "../styles/styles";
import { drawLabels } from "./labels";
import { drawGraticuleLabels } from "./graticuleLabels";

/** Warps a raster layer for the current view and returns a canvas to composite,
 *  or null if unavailable (GL off, texture/tiles loading). Provided by the host,
 *  which owns the WebGL warper + Mercator mosaic and the two-tier decision. */
export type RenderRaster = (
  layer: LayerSpec,
  projection: GeoProjection,
  width: number,
  height: number,
  gridCols: number,
) => HTMLCanvasElement | null;

const SPHERE = { type: "Sphere" } as const;

// Reprojection mesh density: coarse while interacting, fine on idle.
const GRID_INTERACTIVE = 32;
const GRID_IDLE = 110;

export interface RenderOptions {
  projection: GeoProjection;
  world: WorldData;
  style: StyleDef;
  capability: ProjectionCapability;
  width: number;
  height: number;
  pixelRatio: number;
  /** Draw labels + high-detail raster mesh (skipped during interaction). */
  showLabels?: boolean;
  /** Draw graticule degree labels along the frame edge. */
  showGraticuleLabels?: boolean;
  /** Multiplier for stroke widths / font sizes (>1 for high-DPI export). */
  renderScale?: number;
  /** Host-provided raster warping for satellite/terrain styles (optional). */
  renderRaster?: RenderRaster;
}

function isDark(color: string | undefined): boolean {
  if (!color) return false;
  let r = 0, g = 0, b = 0;
  if (color.startsWith("#")) {
    const h = color.slice(1);
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
  } else {
    const m = color.match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return false;
    [r, g, b] = [+m[1], +m[2], +m[3]];
  }
  return 0.299 * r + 0.587 * g + 0.114 * b < 110;
}

interface LayerContext {
  path: ReturnType<typeof geoPath>;
  world: WorldData;
  projection: GeoProjection;
  renderRaster?: RenderRaster;
  width: number;
  height: number;
  gridCols: number;
  /** Multiplier for stroke widths / font sizes (>1 for high-DPI export). */
  scale: number;
}

/**
 * Render a map from a declarative StyleDef. Layer order: background(s) →
 * ocean fill → [clipped content layers in listed order] → sphere outline →
 * labels. Content layers are clipped to the projection's sphere boundary.
 */
export function renderMap(
  ctx: CanvasRenderingContext2D,
  opts: RenderOptions,
): void {
  const { projection, world, style, capability, width, height } = opts;
  const showLabels = opts.showLabels ?? true;
  const s = opts.renderScale ?? 1;
  const path = geoPath(projection, ctx);
  const layerCtx: LayerContext = {
    path,
    world,
    projection,
    renderRaster: opts.renderRaster,
    width,
    height,
    gridCols: showLabels ? GRID_IDLE : GRID_INTERACTIVE,
    scale: s,
  };

  ctx.clearRect(0, 0, width, height);

  const sphere = style.layers.find((l) => l.type === "sphere");
  const labels = style.layers.find((l) => l.type === "labels");

  // 1. Background(s).
  for (const layer of style.layers) {
    if (layer.type !== "background") continue;
    ctx.fillStyle = layer.fill ?? "#ffffff";
    ctx.fillRect(0, 0, width, height);
    if (layer.paper) drawPaperTexture(ctx, width, height);
  }

  // 2. Ocean / sphere fill.
  if (sphere?.fill) {
    ctx.beginPath();
    path(SPHERE);
    ctx.fillStyle = sphere.fill;
    ctx.fill();
  }

  // 3. Clipped content layers, in the order they appear in the style.
  ctx.save();
  ctx.beginPath();
  path(SPHERE);
  ctx.clip();
  for (const layer of style.layers) {
    switch (layer.type) {
      case "background":
      case "sphere":
      case "labels":
        break; // handled outside the clip
      default:
        drawContentLayer(ctx, layer, layerCtx);
    }
  }
  ctx.restore();

  // 4. Sphere outline (frame).
  if (sphere?.stroke) {
    ctx.beginPath();
    path(SPHERE);
    ctx.lineWidth = (sphere.lineWidth ?? 1) * s;
    ctx.strokeStyle = sphere.stroke;
    ctx.stroke();
  }

  // 5. Labels.
  if (showLabels && labels?.labelClasses) {
    drawLabels(ctx, projection, labels.labelClasses, width, height, capability, s);
  }

  // 6. Graticule degree labels (geographic overlay, prj.md §5.6).
  if (opts.showGraticuleLabels) {
    const grat = style.layers.find((l) => l.type === "graticule");
    const bg = style.layers.find((l) => l.type === "background");
    const dark = isDark(bg?.fill);
    drawGraticuleLabels(ctx, projection, capability, width, height, {
      step: grat?.step ?? 15,
      color: dark ? "#ece4d4" : "#4a3f2c",
      halo: dark ? "rgba(6,12,22,0.75)" : bg?.fill ?? "rgba(255,255,255,0.85)",
      fontSize: 11 * s,
      fontFamily: "'EB Garamond', Georgia, serif",
      scale: s,
    });
  }
}

function drawContentLayer(
  ctx: CanvasRenderingContext2D,
  layer: LayerSpec,
  c: LayerContext,
): void {
  const { path, world, scale: s } = c;
  switch (layer.type) {
    case "raster": {
      // The host warps the raster (equirect world texture or Mercator tile
      // mosaic) and returns a canvas; we composite it clipped to the sphere.
      // While it loads (or if GL is off), the ocean fill shows.
      const warped = c.renderRaster?.(layer, c.projection, c.width, c.height, c.gridCols);
      if (warped) ctx.drawImage(warped, 0, 0, c.width, c.height);
      break;
    }
    case "graticule": {
      const step = layer.step ?? 10;
      ctx.beginPath();
      path(geoGraticule().step([step, step])());
      ctx.lineWidth = (layer.lineWidth ?? 0.5) * s;
      ctx.strokeStyle = layer.stroke ?? "#999";
      ctx.stroke();
      break;
    }
    case "coastVignette": {
      // A soft glow into the ocean around the coast: cast a blurred shadow
      // from the land silhouette, then the real fills cover the land.
      ctx.save();
      ctx.shadowColor = layer.color ?? "rgba(0,0,0,0.4)";
      ctx.shadowBlur = (layer.blur ?? 10) * s;
      ctx.beginPath();
      path(world.land);
      ctx.fillStyle = layer.color ?? "rgba(0,0,0,0.4)";
      ctx.fill();
      ctx.restore();
      break;
    }
    case "countries": {
      // A `fill` override flattens the political palette to one land color.
      const palette = layer.palette ?? ["#ccc"];
      const flat = layer.fill;
      for (const f of world.countries.features) {
        const idx = world.countryColor.get(String((f as Feature).id ?? "")) ?? 0;
        ctx.beginPath();
        path(f);
        ctx.fillStyle = flat ?? palette[idx % palette.length];
        ctx.fill();
        if (layer.stroke) {
          ctx.lineWidth = (layer.lineWidth ?? 0.4) * s;
          ctx.strokeStyle = layer.stroke;
          ctx.stroke();
        }
      }
      break;
    }
    case "roads": {
      const roads = getRoadsSync();
      if (!roads) break; // lazy-loaded on demand; MapCanvas triggers the fetch
      ctx.beginPath();
      path(roads);
      ctx.lineWidth = (layer.lineWidth ?? 0.4) * s;
      ctx.strokeStyle = layer.stroke ?? "#a2624a";
      ctx.stroke();
      break;
    }
    case "land": {
      ctx.beginPath();
      path(world.land);
      if (layer.fill) {
        ctx.fillStyle = layer.fill;
        ctx.fill();
      }
      if (layer.stroke) {
        ctx.lineWidth = (layer.lineWidth ?? 0.7) * s;
        ctx.strokeStyle = layer.stroke;
        ctx.stroke();
      }
      break;
    }
    case "borders": {
      ctx.beginPath();
      path(world.borders);
      ctx.lineWidth = (layer.lineWidth ?? 0.6) * s;
      ctx.strokeStyle = layer.stroke ?? "#888";
      if (layer.lineDash) ctx.setLineDash(layer.lineDash.map((d) => d * s));
      ctx.stroke();
      if (layer.lineDash) ctx.setLineDash([]);
      break;
    }
    case "rivers": {
      ctx.beginPath();
      path(rivers);
      ctx.lineWidth = (layer.lineWidth ?? 0.6) * s;
      ctx.strokeStyle = layer.stroke ?? "#8fb0c4";
      ctx.stroke();
      break;
    }
    case "lakes": {
      ctx.beginPath();
      path(lakes);
      if (layer.fill) {
        ctx.fillStyle = layer.fill;
        ctx.fill();
      }
      if (layer.stroke) {
        ctx.lineWidth = (layer.lineWidth ?? 0.4) * s;
        ctx.strokeStyle = layer.stroke;
        ctx.stroke();
      }
      break;
    }
  }
}

// Subtle deterministic paper speckle — cheap, avoids shipping a texture image.
function drawPaperTexture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  ctx.save();
  let seed = 0x9e3779b9;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const count = Math.floor((width * height) / 1400);
  for (let i = 0; i < count; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const a = 0.02 + rand() * 0.04;
    ctx.fillStyle =
      rand() > 0.5 ? `rgba(120,95,60,${a})` : `rgba(255,250,235,${a})`;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();
}
