import { geoDistance, type GeoProjection } from "d3-geo";
import { getGazetteer } from "../geo/gazetteer";
import { places } from "../data/physical";
import type { ProjectionCapability } from "../geo/projections";
import type { LabelClass } from "../styles/styles";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Candidate {
  text: string;
  lon: number;
  lat: number;
  importance: number; // higher = keep first within a priority
  cls: LabelClass;
}

const DEG = Math.PI / 180;

function fontFor(cls: LabelClass): string {
  const style = cls.italic ? "italic " : "";
  const weight = cls.weight ?? 400;
  return `${style}${weight} ${cls.sizePx}px ${cls.font}`;
}

function overlaps(a: Box, boxes: Box[]): boolean {
  for (const b of boxes) {
    if (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Draw labels after projection: gather candidates per class (respecting each
 * class's minScale), skip anchors that are clipped/off-canvas/on the far side
 * of the globe, then greedily place by (priority, importance) rejecting
 * overlaps. See prj.md §5.5.
 */
export function drawLabels(
  ctx: CanvasRenderingContext2D,
  projection: GeoProjection,
  classes: LabelClass[],
  width: number,
  height: number,
  capability: ProjectionCapability,
): void {
  const scale = projection.scale();
  const rot = projection.rotate();
  const center: [number, number] = [-rot[0], -rot[1]];
  const maxDist = (capability.clipAngle ?? 90) * DEG;

  const gaz = getGazetteer();
  const candidates: Candidate[] = [];

  for (const cls of classes) {
    if (cls.minScale && scale < cls.minScale) continue;
    if (cls.kind === "country" || cls.kind === "ocean") {
      for (const e of gaz) {
        if (e.kind !== cls.kind) continue;
        candidates.push({
          text: e.name,
          lon: e.centroid[0],
          lat: e.centroid[1],
          importance: 0,
          cls,
        });
      }
    } else {
      const wantCapital = cls.kind === "capital";
      for (const p of places) {
        if (p.isCapital !== wantCapital) continue;
        candidates.push({
          text: p.name,
          lon: p.lon,
          lat: p.lat,
          importance: p.pop,
          cls,
        });
      }
    }
  }

  candidates.sort(
    (a, b) => a.cls.priority - b.cls.priority || b.importance - a.importance,
  );

  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const placed: Box[] = [];

  for (const c of candidates) {
    const pt = projection([c.lon, c.lat]);
    if (!pt) continue;
    const [x, y] = pt;
    if (x < 0 || y < 0 || x > width || y > height) continue;
    // Hidden on the far side of a clipping projection (e.g. orthographic).
    if (capability.clipsToSphere) {
      if (geoDistance([c.lon, c.lat], center) > maxDist * 0.98) continue;
    }

    const cls = c.cls;
    ctx.font = fontFor(cls);
    ctx.letterSpacing = `${cls.letterSpacing ?? 0}px`;
    ctx.fontVariantCaps = cls.smallCaps ? "small-caps" : "normal";
    const text = cls.uppercase ? c.text.toUpperCase() : c.text;
    const tw = ctx.measureText(text).width;
    const th = cls.sizePx;
    const isPoint = cls.kind === "capital" || cls.kind === "city";

    const drawX = isPoint ? x + 5 : x;
    const boxX = isPoint ? drawX : drawX - tw / 2;
    const box: Box = { x: boxX - 2, y: y - th / 2 - 2, w: tw + 4, h: th + 4 };
    if (overlaps(box, placed)) continue;
    placed.push(box);

    ctx.textAlign = isPoint ? "left" : "center";
    if (isPoint) {
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = cls.color;
      ctx.fill();
    }
    if (cls.halo) {
      ctx.lineWidth = cls.haloWidth ?? 3;
      ctx.strokeStyle = cls.halo;
      ctx.strokeText(text, drawX, y);
    }
    ctx.fillStyle = cls.color;
    ctx.fillText(text, drawX, y);
  }

  ctx.letterSpacing = "0px";
  ctx.fontVariantCaps = "normal";
  ctx.textAlign = "left";
}
