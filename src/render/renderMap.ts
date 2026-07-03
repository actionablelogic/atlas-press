import { geoGraticule, geoPath, type GeoProjection } from "d3-geo";
import type { Feature } from "geojson";
import type { WorldData } from "../geo/data";
import type { ProjectionCapability } from "../geo/projections";
import { lakes, rivers } from "../data/physical";
import type { LayerSpec, StyleDef } from "../styles/styles";
import type { RasterWarper } from "./RasterWarper";
import { drawLabels } from "./labels";

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
  /** WebGL raster warper for satellite/terrain styles (optional). */
  warper?: RasterWarper;
}

interface LayerContext {
  path: ReturnType<typeof geoPath>;
  world: WorldData;
  projection: GeoProjection;
  warper?: RasterWarper;
  width: number;
  height: number;
  gridCols: number;
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
  const { projection, world, style, capability, width, height, warper } = opts;
  const showLabels = opts.showLabels ?? true;
  const path = geoPath(projection, ctx);
  const layerCtx: LayerContext = {
    path,
    world,
    projection,
    warper,
    width,
    height,
    gridCols: showLabels ? GRID_IDLE : GRID_INTERACTIVE,
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
    ctx.lineWidth = sphere.lineWidth ?? 1;
    ctx.strokeStyle = sphere.stroke;
    ctx.stroke();
  }

  // 5. Labels.
  if (showLabels && labels?.labelClasses) {
    drawLabels(
      ctx,
      projection,
      labels.labelClasses,
      width,
      height,
      capability,
    );
  }
}

function drawContentLayer(
  ctx: CanvasRenderingContext2D,
  layer: LayerSpec,
  c: LayerContext,
): void {
  const { path, world } = c;
  switch (layer.type) {
    case "raster": {
      // Warp the equirectangular texture into the current projection on the GPU,
      // then composite the result (already clipped to the sphere here). If GL is
      // unsupported or the texture is still loading, the ocean fill shows.
      if (!layer.texture || !c.warper?.supported) break;
      const drawn = c.warper.render(
        c.projection,
        c.width,
        c.height,
        c.gridCols,
        layer.texture,
      );
      if (drawn) ctx.drawImage(c.warper.canvas, 0, 0, c.width, c.height);
      break;
    }
    case "graticule": {
      const step = layer.step ?? 10;
      ctx.beginPath();
      path(geoGraticule().step([step, step])());
      ctx.lineWidth = layer.lineWidth ?? 0.5;
      ctx.strokeStyle = layer.stroke ?? "#999";
      ctx.stroke();
      break;
    }
    case "coastVignette": {
      // A soft glow into the ocean around the coast: cast a blurred shadow
      // from the land silhouette, then the real fills cover the land.
      ctx.save();
      ctx.shadowColor = layer.color ?? "rgba(0,0,0,0.4)";
      ctx.shadowBlur = layer.blur ?? 10;
      ctx.beginPath();
      path(world.land);
      ctx.fillStyle = layer.color ?? "rgba(0,0,0,0.4)";
      ctx.fill();
      ctx.restore();
      break;
    }
    case "countries": {
      const palette = layer.palette ?? ["#ccc"];
      for (const f of world.countries.features) {
        const idx = world.countryColor.get(String((f as Feature).id ?? "")) ?? 0;
        ctx.beginPath();
        path(f);
        ctx.fillStyle = palette[idx % palette.length];
        ctx.fill();
        if (layer.stroke) {
          ctx.lineWidth = layer.lineWidth ?? 0.4;
          ctx.strokeStyle = layer.stroke;
          ctx.stroke();
        }
      }
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
        ctx.lineWidth = layer.lineWidth ?? 0.7;
        ctx.strokeStyle = layer.stroke;
        ctx.stroke();
      }
      break;
    }
    case "borders": {
      ctx.beginPath();
      path(world.borders);
      ctx.lineWidth = layer.lineWidth ?? 0.6;
      ctx.strokeStyle = layer.stroke ?? "#888";
      if (layer.lineDash) ctx.setLineDash(layer.lineDash);
      ctx.stroke();
      if (layer.lineDash) ctx.setLineDash([]);
      break;
    }
    case "rivers": {
      ctx.beginPath();
      path(rivers);
      ctx.lineWidth = layer.lineWidth ?? 0.6;
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
        ctx.lineWidth = layer.lineWidth ?? 0.4;
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
