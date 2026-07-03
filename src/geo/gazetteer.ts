import { geoArea, geoCentroid } from "d3-geo";
import type { Feature, Geometry, Polygon, Position } from "geojson";
import { getWorld } from "./data";
import type { ProjectionId } from "./projections";

export type RegionKind = "country" | "continent" | "ocean";

export interface GazetteerEntry {
  id: string;
  name: string;
  kind: RegionKind;
  /** [lon, lat] used to center the projection. */
  centroid: [number, number];
  /** GeoJSON fed to fitExtent (largest landmass for countries; a framing
   *  rectangle for continents/oceans). */
  fitFeature: Feature<Geometry>;
  /** Auto-suggested projection on select (polar regions → azimuthal). */
  suggestProjection?: ProjectionId;
}

// --- curated continents & oceans -------------------------------------
// bbox = [west, south, east, north]; west/east may exceed ±180 to describe
// antimeridian-spanning framing (e.g. the Pacific). See prj.md §5.1.
interface Curated {
  name: string;
  centroid: [number, number];
  bbox: [number, number, number, number];
  suggest?: ProjectionId;
}

const CONTINENTS: Curated[] = [
  { name: "Africa", centroid: [20, 2], bbox: [-19, -36, 52, 38] },
  {
    name: "Antarctica",
    centroid: [0, -90],
    bbox: [-180, -90, 180, -60],
    suggest: "azimuthalEquidistant",
  },
  { name: "Asia", centroid: [90, 40], bbox: [25, -11, 180, 78] },
  { name: "Europe", centroid: [15, 56], bbox: [-25, 34, 46, 72] },
  { name: "North America", centroid: [-100, 46], bbox: [-168, 7, -52, 83] },
  { name: "Oceania", centroid: [150, -22], bbox: [110, -50, 190, 0] },
  { name: "South America", centroid: [-60, -21], bbox: [-82, -56, -34, 13] },
];

const OCEANS: Curated[] = [
  // Big five
  { name: "Pacific Ocean", centroid: [-160, 0], bbox: [120, -60, 290, 60] },
  { name: "Atlantic Ocean", centroid: [-25, 0], bbox: [-70, -60, 20, 66] },
  { name: "Indian Ocean", centroid: [75, -22], bbox: [20, -60, 120, 30] },
  {
    name: "Arctic Ocean",
    centroid: [0, 90],
    bbox: [-180, 66, 180, 90],
    suggest: "azimuthalEquidistant",
  },
  {
    name: "Southern Ocean",
    centroid: [0, -65],
    bbox: [-180, -78, 180, -50],
    suggest: "azimuthalEquidistant",
  },
  // Major seas (see prj.md open question #4 — a sensible starter set)
  { name: "Mediterranean Sea", centroid: [18, 35], bbox: [-6, 30, 37, 46] },
  { name: "Caribbean Sea", centroid: [-75, 15], bbox: [-89, 9, -60, 22] },
  { name: "South China Sea", centroid: [114, 12], bbox: [105, 3, 122, 23] },
  { name: "Caspian Sea", centroid: [50, 41], bbox: [46, 36, 55, 47] },
  { name: "Red Sea", centroid: [38, 21], bbox: [32, 12, 44, 30] },
  { name: "Bay of Bengal", centroid: [88, 15], bbox: [80, 5, 100, 23] },
  { name: "Gulf of Mexico", centroid: [-90, 25], bbox: [-98, 18, -80, 31] },
  { name: "Black Sea", centroid: [34, 43], bbox: [27, 40, 42, 47] },
  { name: "North Sea", centroid: [3, 56], bbox: [-4, 51, 9, 61] },
  { name: "Baltic Sea", centroid: [19, 59], bbox: [10, 53, 30, 66] },
];

/** Densified framing rectangle so fitExtent bounds stay accurate on curved
 *  projections. Longitudes are kept raw (may exceed ±180) for antimeridian. */
function rectFeature([w, s, e, n]: [number, number, number, number]): Feature<
  Polygon
> {
  const steps = 16;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const ring: Position[] = [];
  for (let i = 0; i <= steps; i++) ring.push([lerp(w, e, i / steps), s]);
  for (let i = 1; i <= steps; i++) ring.push([e, lerp(s, n, i / steps)]);
  for (let i = 1; i <= steps; i++) ring.push([lerp(e, w, i / steps), n]);
  for (let i = 1; i <= steps; i++) ring.push([w, lerp(n, s, i / steps)]);
  const feature: Feature<Polygon> = {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [ring] },
  };
  // A reversed ring makes d3 read the polygon as the whole sphere minus the
  // box (geoArea → ~4π), which breaks fitExtent. Enforce the small-side ring.
  if (geoArea(feature) > 2 * Math.PI) ring.reverse();
  return feature;
}

/** Largest-area piece of a (possibly Multi)Polygon country. Drops far-flung
 *  overseas territories so e.g. France frames metropolitan France, not the
 *  globe. */
function primaryLandmass(feature: Feature<Geometry>): Feature<Geometry> {
  const g = feature.geometry;
  if (!g || g.type !== "MultiPolygon") return feature;
  let best: Position[][] | null = null;
  let bestArea = -Infinity;
  for (const coordinates of g.coordinates) {
    const poly: Polygon = { type: "Polygon", coordinates };
    let area = geoArea(poly);
    // geoArea returns the region to the ring's left; an antimeridian-crossing
    // ring with reversed winding reports ~the whole sphere. No real country
    // landmass exceeds half the sphere, so fold it back to its complement
    // (fixes e.g. Fiji, whose islands straddle 180°).
    if (area > 2 * Math.PI) area = 4 * Math.PI - area;
    if (area > bestArea) {
      bestArea = area;
      best = coordinates;
    }
  }
  return best
    ? {
        type: "Feature",
        properties: feature.properties,
        geometry: { type: "Polygon", coordinates: best },
      }
    : feature;
}

function curatedEntry(c: Curated, kind: RegionKind): GazetteerEntry {
  return {
    id: `${kind}-${c.name}`,
    name: c.name,
    kind,
    centroid: c.centroid,
    fitFeature: rectFeature(c.bbox),
    suggestProjection: c.suggest,
  };
}

let cache: GazetteerEntry[] | null = null;

export function getGazetteer(): GazetteerEntry[] {
  if (cache) return cache;
  const world = getWorld("50m");

  const countries: GazetteerEntry[] = [];
  for (const f of world.countries.features) {
    const name = (f.properties?.name as string) ?? "";
    if (!name) continue;
    const fit = primaryLandmass(f as Feature<Geometry>);
    const centroid = geoCentroid(fit) as [number, number];
    if (!Number.isFinite(centroid[0]) || !Number.isFinite(centroid[1])) continue;
    countries.push({
      id: `country-${f.id ?? name}`,
      name,
      kind: "country",
      centroid,
      fitFeature: fit,
    });
  }

  cache = [
    ...CONTINENTS.map((c) => curatedEntry(c, "continent")),
    ...OCEANS.map((c) => curatedEntry(c, "ocean")),
    ...countries,
  ].sort((a, b) => a.name.localeCompare(b.name));
  return cache;
}

// --- fuzzy search ----------------------------------------------------
function scoreMatch(query: string, text: string): number | null {
  if (text === query) return 1000;
  if (text.startsWith(query)) return 600 - text.length;
  const idx = text.indexOf(query);
  if (idx >= 0) return 300 - idx - text.length * 0.1;
  // subsequence fallback (handles typos/skips like "gemny" → "germany")
  let qi = 0;
  for (let i = 0; i < text.length && qi < query.length; i++) {
    if (text[i] === query[qi]) qi++;
  }
  return qi === query.length ? 40 - text.length * 0.1 : null;
}

// Nudge continents/oceans slightly above same-scoring countries.
const KIND_BOOST: Record<RegionKind, number> = {
  continent: 6,
  ocean: 4,
  country: 0,
};

export function searchGazetteer(query: string, limit = 8): GazetteerEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: Array<{ score: number; entry: GazetteerEntry }> = [];
  for (const entry of getGazetteer()) {
    const s = scoreMatch(q, entry.name.toLowerCase());
    if (s != null) scored.push({ score: s + KIND_BOOST[entry.kind], entry });
  }
  scored.sort(
    (a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name),
  );
  return scored.slice(0, limit).map((s) => s.entry);
}
