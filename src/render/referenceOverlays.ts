import { geoDistance, type GeoProjection } from "d3-geo";
import type { Feature, LineString } from "geojson";
import type { ProjectionCapability } from "../geo/projections";

const EARTH_R = 6371008.8; // mean radius, metres
const TROPIC = 23.4369;
const POLAR = 66.5636;

interface RefStyle {
  color: string;
  scale: number;
}

function parallel(lat: number): Feature<LineString> {
  const coords: [number, number][] = [];
  for (let lon = -180; lon <= 180; lon += 3) coords.push([lon, lat]);
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } };
}

/** Equator (solid), tropics + polar circles (dashed) — reproject with the map. */
export function drawReferenceLines(
  ctx: CanvasRenderingContext2D,
  path: (feature: Feature<LineString>) => void,
  projection: GeoProjection,
  capability: ProjectionCapability,
  width: number,
  height: number,
  s: RefStyle,
): void {
  const rot = projection.rotate();
  const center: [number, number] = [-rot[0], -rot[1]];
  const maxDist = ((capability.clipAngle ?? 90) * Math.PI) / 180;

  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.font = `italic 600 ${9.5 * s.scale}px 'EB Garamond', Georgia, serif`;
  ctx.textBaseline = "middle";

  const lines: Array<{ lat: number; label: string; dash: boolean }> = [
    { lat: 0, label: "Equator", dash: false },
    { lat: TROPIC, label: "Tropic of Cancer", dash: true },
    { lat: -TROPIC, label: "Tropic of Capricorn", dash: true },
    { lat: POLAR, label: "Arctic Circle", dash: true },
    { lat: -POLAR, label: "Antarctic Circle", dash: true },
  ];

  for (const { lat, label, dash } of lines) {
    ctx.beginPath();
    path(parallel(lat));
    ctx.lineWidth = (dash ? 0.7 : 1) * s.scale;
    ctx.setLineDash(dash ? [5 * s.scale, 4 * s.scale] : []);
    ctx.stroke();

    // Label at the left-most visible point of the parallel.
    let best: [number, number] | null = null;
    for (let lon = -180; lon <= 180; lon += 4) {
      if (capability.clipsToSphere && geoDistance([lon, lat], center) > maxDist) continue;
      const p = projection([lon, lat]);
      if (!p) continue;
      const [x, y] = p;
      if (x < 0 || y < 0 || x > width || y > height) continue;
      if (!best || x < best[0]) best = p;
    }
    if (best) {
      ctx.setLineDash([]);
      ctx.textAlign = "left";
      ctx.fillText(label, Math.min(width - 90 * s.scale, best[0] + 5 * s.scale), best[1] - 6 * s.scale);
    }
  }
  ctx.setLineDash([]);
  ctx.restore();
}

/** A scale bar with a "true here" caveat (scale is only locally exact). */
export function drawScaleBar(
  ctx: CanvasRenderingContext2D,
  projection: GeoProjection,
  width: number,
  height: number,
  s: RefStyle,
): void {
  const margin = Math.max(24, Math.min(width, height) * 0.06) * 1;
  // Anchor bottom-left; fall back inward if that point is off the globe.
  const anchors: Array<[number, number]> = [
    [margin, height - margin],
    [width * 0.16, height * 0.84],
  ];
  let x0 = 0;
  let y0 = 0;
  let mPerPx = 0;
  for (const [ax, ay] of anchors) {
    const a = projection.invert?.([ax, ay]);
    const b = projection.invert?.([ax + 100, ay]);
    if (a && b && Number.isFinite(a[0]) && Number.isFinite(b[0])) {
      mPerPx = (geoDistance(a, b) * EARTH_R) / 100;
      x0 = ax;
      y0 = ay;
      break;
    }
  }
  if (mPerPx <= 0 || !Number.isFinite(mPerPx)) return;

  const targetMeters = mPerPx * width * 0.22;
  const nice = niceRound(targetMeters);
  const barPx = nice / mPerPx;
  const km = nice >= 1000;
  const labelText = km ? `${Math.round(nice / 1000)} km` : `${Math.round(nice)} m`;

  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  const lw = 1.4 * s.scale;
  const h = 6 * s.scale;
  ctx.lineWidth = lw;
  // bar with end ticks
  ctx.beginPath();
  ctx.moveTo(x0, y0 - h);
  ctx.lineTo(x0, y0);
  ctx.lineTo(x0 + barPx, y0);
  ctx.lineTo(x0 + barPx, y0 - h);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x0 + barPx / 2, y0);
  ctx.lineTo(x0 + barPx / 2, y0 - h * 0.6);
  ctx.stroke();

  ctx.font = `600 ${10 * s.scale}px 'EB Garamond', Georgia, serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(labelText, x0, y0 - h - 4 * s.scale);
  ctx.font = `italic ${7.5 * s.scale}px 'EB Garamond', Georgia, serif`;
  ctx.globalAlpha = 0.75;
  ctx.textBaseline = "top";
  ctx.fillText("scale true here", x0, y0 + 2 * s.scale);
  ctx.restore();
}

function niceRound(v: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / pow;
  const nice = f >= 5 ? 5 : f >= 2 ? 2 : 1;
  return nice * pow;
}
