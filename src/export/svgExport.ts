import { geoGraticule, geoPath, type GeoProjection } from "d3-geo";
import type { Feature } from "geojson";
import type { ProjectionId } from "../geo/projections";
import { getWorld } from "../geo/data";
import { getGazetteer } from "../geo/gazetteer";
import { lakes, rivers } from "../data/physical";
import type { View } from "../geo/view";
import type { LabelClass, StyleDef } from "../styles/styles";
import type { Overlay } from "../overlays/types";
import { buildProjection } from "../geo/view";
import type { ExportDims } from "./sizes";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function isVectorStyle(style: StyleDef): boolean {
  return !style.layers.some((l) => l.type === "raster");
}

export interface SvgRequest {
  projectionId: ProjectionId;
  view: View;
  style: StyleDef;
  showGraticuleLabels: boolean;
  overlays: Overlay[];
  footer: string | null;
  previewW: number;
  previewH: number;
  dims: ExportDims;
}

/** True vector SVG for vector styles (infinite resolution for print shops). */
export function exportSvg(req: SvgRequest): string {
  const { style, previewW: W, previewH: H } = req;
  const projection = buildProjection(req.projectionId, req.view);
  const path = geoPath(projection); // no context → returns SVG path `d`
  const world = getWorld("50m");
  const out: string[] = [];
  const sphere = { type: "Sphere" } as const;

  const bg = style.layers.find((l) => l.type === "background");
  const sph = style.layers.find((l) => l.type === "sphere");

  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${req.dims.width}" height="${req.dims.height}" viewBox="0 0 ${W} ${H}">`,
  );
  if (bg?.fill) out.push(`<rect width="${W}" height="${H}" fill="${bg.fill}"/>`);

  const sphereD = path(sphere) ?? "";
  out.push(`<clipPath id="sph"><path d="${sphereD}"/></clipPath>`);
  if (sph?.fill) out.push(`<path d="${sphereD}" fill="${sph.fill}"/>`);

  out.push(`<g clip-path="url(#sph)">`);
  for (const layer of style.layers) {
    if (layer.type === "graticule") {
      const step = layer.step ?? 10;
      out.push(
        `<path d="${path(geoGraticule().step([step, step])()) ?? ""}" fill="none" stroke="${layer.stroke ?? "#999"}" stroke-width="${layer.lineWidth ?? 0.5}"/>`,
      );
    } else if (layer.type === "countries") {
      const palette = layer.palette ?? ["#ccc"];
      const flat = layer.fill;
      for (const f of world.countries.features) {
        const idx = world.countryColor.get(String((f as Feature).id ?? "")) ?? 0;
        const d = path(f);
        if (!d) continue;
        const stroke = layer.stroke ? ` stroke="${layer.stroke}" stroke-width="${layer.lineWidth ?? 0.4}"` : "";
        out.push(`<path d="${d}" fill="${flat ?? palette[idx % palette.length]}"${stroke}/>`);
      }
    } else if (layer.type === "land") {
      const d = path(world.land) ?? "";
      const fill = layer.fill ? ` fill="${layer.fill}"` : ` fill="none"`;
      const stroke = layer.stroke ? ` stroke="${layer.stroke}" stroke-width="${layer.lineWidth ?? 0.7}"` : "";
      out.push(`<path d="${d}"${fill}${stroke}/>`);
    } else if (layer.type === "borders") {
      out.push(`<path d="${path(world.borders) ?? ""}" fill="none" stroke="${layer.stroke ?? "#888"}" stroke-width="${layer.lineWidth ?? 0.6}"/>`);
    } else if (layer.type === "rivers") {
      out.push(`<path d="${path(rivers) ?? ""}" fill="none" stroke="${layer.stroke ?? "#8fb0c4"}" stroke-width="${layer.lineWidth ?? 0.6}"/>`);
    } else if (layer.type === "lakes") {
      const d = path(lakes) ?? "";
      const fill = layer.fill ? ` fill="${layer.fill}"` : ` fill="none"`;
      out.push(`<path d="${d}"${fill} stroke="${layer.stroke ?? "#8fb0c4"}" stroke-width="${layer.lineWidth ?? 0.4}"/>`);
    }
  }
  out.push(`</g>`); // end clip

  if (sph?.stroke) {
    out.push(`<path d="${sphereD}" fill="none" stroke="${sph.stroke}" stroke-width="${sph.lineWidth ?? 1}"/>`);
  }

  // Labels (country + ocean; centroid placement, simple greedy declutter).
  const labels = style.layers.find((l) => l.type === "labels")?.labelClasses ?? [];
  out.push(svgLabels(projection, labels, W, H));

  // Decor overlays.
  out.push(svgOverlays(req.overlays, W, H));
  if (req.footer) {
    out.push(
      `<text x="${W / 2}" y="${H - 10}" text-anchor="middle" font-family="'EB Garamond',serif" font-size="11" fill="rgba(60,54,44,0.75)">${esc(req.footer)}</text>`,
    );
  }

  out.push(`</svg>`);
  return out.join("\n");
}

function svgLabels(
  projection: GeoProjection,
  classes: LabelClass[],
  W: number,
  H: number,
): string {
  const gaz = getGazetteer();
  const placed: Array<[number, number]> = [];
  const parts: string[] = [];
  for (const cls of classes) {
    if (cls.kind !== "country" && cls.kind !== "ocean") continue;
    for (const e of gaz) {
      if (e.kind !== cls.kind) continue;
      const p = projection(e.centroid);
      if (!p) continue;
      const [x, y] = p;
      if (x < 0 || y < 0 || x > W || y > H) continue;
      if (placed.some(([px, py]) => Math.abs(px - x) < 40 && Math.abs(py - y) < 12)) continue;
      placed.push([x, y]);
      const text = cls.uppercase ? e.name.toUpperCase() : e.name;
      const style = cls.italic ? ' font-style="italic"' : "";
      const ls = cls.letterSpacing ? ` letter-spacing="${cls.letterSpacing}"` : "";
      parts.push(
        `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-family="${esc(cls.font)}" font-size="${cls.sizePx}"${style}${ls} fill="${cls.color}">${esc(text)}</text>`,
      );
    }
  }
  return parts.join("\n");
}

function svgOverlays(overlays: Overlay[], W: number, H: number): string {
  const parts: string[] = [];
  for (const o of overlays) {
    if (o.type === "frame") {
      const inset = 0.012 * Math.min(W, H);
      const lw = Math.max(1, 0.0016 * Math.min(W, H));
      parts.push(
        `<rect x="${inset}" y="${inset}" width="${W - 2 * inset}" height="${H - 2 * inset}" fill="none" stroke="${o.color}" stroke-width="${lw}"/>`,
      );
      if (o.pattern !== "thin") {
        const g = lw * 3;
        parts.push(
          `<rect x="${inset + g}" y="${inset + g}" width="${W - 2 * (inset + g)}" height="${H - 2 * (inset + g)}" fill="none" stroke="${o.color}" stroke-width="${lw}"/>`,
        );
      }
    }
  }
  for (const o of overlays) {
    if (o.type === "frame") continue;
    const cx = o.x * W;
    const cy = o.y * H;
    const t = `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${o.rotation})`;
    if (o.type === "text") {
      parts.push(
        `<g transform="${t}"><text text-anchor="middle" dominant-baseline="middle" font-family="${esc(o.font)}" font-size="${(o.sizeRel * H * o.scale).toFixed(1)}" fill="${o.color}">${esc(o.text)}</text></g>`,
      );
    } else if (o.type === "cartouche") {
      const ts = 0.045 * H * o.scale;
      parts.push(
        `<g transform="${t}" text-anchor="middle"><text y="${o.subtitle ? -ts * 0.3 : 0}" dominant-baseline="middle" font-family="'Playfair Display',serif" font-weight="700" font-size="${ts.toFixed(1)}" fill="#2c2822">${esc(o.title)}</text>` +
          (o.subtitle
            ? `<text y="${(ts * 0.8).toFixed(1)}" dominant-baseline="middle" font-family="'EB Garamond',serif" font-style="italic" font-size="${(ts * 0.5).toFixed(1)}" fill="#6b6152">${esc(o.subtitle)}</text>`
            : "") +
          `</g>`,
      );
    } else if (o.type === "compass") {
      const r = 0.08 * H * o.scale;
      parts.push(
        `<g transform="${t}"><circle r="${r}" fill="none" stroke="#7a6a4f" stroke-width="${r * 0.03}"/>` +
          `<circle r="${r * 0.82}" fill="none" stroke="#7a6a4f" stroke-width="${r * 0.016}"/>` +
          `<polygon points="0,${-r} ${r * 0.14},0 0,0" fill="#2c2822"/>` +
          `<polygon points="0,${-r} ${-r * 0.14},0 0,0" fill="#efe6d2" stroke="#2c2822" stroke-width="${r * 0.012}"/>` +
          `<polygon points="0,${r} ${r * 0.14},0 0,0" fill="#2c2822"/>` +
          `<polygon points="0,${r} ${-r * 0.14},0 0,0" fill="#efe6d2" stroke="#2c2822" stroke-width="${r * 0.012}"/>` +
          `<text y="${(-r * 0.82).toFixed(1)}" text-anchor="middle" font-family="'EB Garamond',serif" font-weight="700" font-size="${(r * 0.28).toFixed(1)}" fill="#2c2822">N</text></g>`,
      );
    }
  }
  return parts.join("\n");
}
