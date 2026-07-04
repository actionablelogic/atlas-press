import { geoDistance, type GeoProjection } from "d3-geo";
import type { ProjectionCapability } from "../geo/projections";

const DEG = Math.PI / 180;

function fmtLon(lon: number): string {
  const l = ((lon + 540) % 360) - 180;
  if (l === 0) return "0°";
  if (Math.abs(l) === 180) return "180°";
  return `${Math.abs(Math.round(l))}°${l > 0 ? "E" : "W"}`;
}

function fmtLat(lat: number): string {
  if (lat === 0) return "0°";
  return `${Math.abs(Math.round(lat))}°${lat > 0 ? "N" : "S"}`;
}

export interface GraticuleLabelOptions {
  step: number;
  color: string;
  halo: string;
  font: string;
}

/**
 * Degree labels along the frame edge (prj.md §5.6): meridians labelled at their
 * topmost visible point, parallels at their leftmost. Reprojects with the map.
 */
export function drawGraticuleLabels(
  ctx: CanvasRenderingContext2D,
  projection: GeoProjection,
  capability: ProjectionCapability,
  width: number,
  height: number,
  opts: GraticuleLabelOptions,
): void {
  const rot = projection.rotate();
  const center: [number, number] = [-rot[0], -rot[1]];
  const maxDist = (capability.clipAngle ?? 90) * DEG;
  const step = Math.max(5, opts.step);

  ctx.save();
  ctx.font = opts.font;
  ctx.fillStyle = opts.color;
  ctx.strokeStyle = opts.halo;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const visible = (lon: number, lat: number): [number, number] | null => {
    if (capability.clipsToSphere && geoDistance([lon, lat], center) > maxDist) {
      return null;
    }
    const p = projection([lon, lat]);
    if (!p) return null;
    const [x, y] = p;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (x < 0 || y < 0 || x > width || y > height) return null;
    return [x, y];
  };

  const label = (text: string, x: number, y: number) => {
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  };

  // Meridians → topmost visible point.
  for (let lon = -180; lon < 180; lon += step) {
    let best: [number, number] | null = null;
    for (let lat = -85; lat <= 85; lat += 2) {
      const p = visible(lon, lat);
      if (p && (!best || p[1] < best[1])) best = p;
    }
    if (best) label(fmtLon(lon), best[0], Math.max(9, best[1] - 8));
  }

  // Parallels → leftmost visible point.
  for (let lat = -60; lat <= 60; lat += step) {
    let best: [number, number] | null = null;
    for (let lon = -180; lon <= 180; lon += 2) {
      const p = visible(lon, lat);
      if (p && (!best || p[0] < best[0])) best = p;
    }
    if (best) {
      ctx.textAlign = "left";
      label(fmtLat(lat), Math.min(width - 24, best[0] + 6), best[1]);
      ctx.textAlign = "center";
    }
  }

  ctx.restore();
}
