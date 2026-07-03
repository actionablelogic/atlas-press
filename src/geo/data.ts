import { feature, mesh, neighbors } from "topojson-client";
import type {
  Feature,
  FeatureCollection,
  MultiLineString,
  GeoJsonProperties,
  Geometry,
} from "geojson";

// world-atlas ships Natural Earth at three detail levels. 110m for
// interaction, 50m for idle/full quality (M1 uses 110m + 50m).
import countries110 from "world-atlas/countries-110m.json";
import countries50 from "world-atlas/countries-50m.json";

export type DetailLevel = "110m" | "50m";

export interface WorldData {
  /** Land polygons (dissolved) for filling continents. */
  land: FeatureCollection<Geometry, GeoJsonProperties>;
  /** Per-country polygons. */
  countries: FeatureCollection<Geometry, GeoJsonProperties>;
  /** Interior borders only (shared edges), for crisp thin border lines. */
  borders: Feature<MultiLineString>;
  /** Greedy graph-coloring index per country id (neighbors differ). */
  countryColor: Map<string, number>;
}

// topojson-client is untyped against our loose Topology shim; cast at the
// boundary. The runtime shape is standard TopoJSON.
/* eslint-disable @typescript-eslint/no-explicit-any */
function build(topology: any): WorldData {
  const countries = feature(
    topology,
    topology.objects.countries,
  ) as unknown as FeatureCollection<Geometry, GeoJsonProperties>;

  // topojson `feature` returns a FeatureCollection for a GeometryCollection
  // (which `land` is) or a single Feature otherwise — normalize to a
  // FeatureCollection. (Wrapping an already-FeatureCollection in another
  // FeatureCollection produces a nested structure that geoPath renders as
  // nothing, which silently drops all land fill.)
  const landResult = feature(topology, topology.objects.land) as unknown as
    | Feature<Geometry, GeoJsonProperties>
    | FeatureCollection<Geometry, GeoJsonProperties>;
  const land: FeatureCollection<Geometry, GeoJsonProperties> =
    landResult.type === "FeatureCollection"
      ? landResult
      : { type: "FeatureCollection", features: [landResult] };

  const borders = mesh(
    topology,
    topology.objects.countries,
    (a: any, b: any) => a !== b,
  ) as MultiLineString;

  // Greedy graph-coloring so adjacent countries never share a fill (planar
  // maps need ≤4; islands/enclaves may push to 5–6). Index is palette-agnostic.
  const geoms: Array<{ id?: string | number }> =
    topology.objects.countries.geometries;
  const adjacency = neighbors(geoms as any[]);
  const colorIdx = new Array<number>(geoms.length).fill(-1);
  for (let i = 0; i < geoms.length; i++) {
    const used = new Set<number>();
    for (const j of adjacency[i]) if (colorIdx[j] >= 0) used.add(colorIdx[j]);
    let c = 0;
    while (used.has(c)) c++;
    colorIdx[i] = c;
  }
  const countryColor = new Map<string, number>();
  geoms.forEach((g, i) => countryColor.set(String(g.id ?? i), colorIdx[i]));

  return {
    land,
    countries,
    borders: { type: "Feature", properties: {}, geometry: borders },
    countryColor,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const cache = new Map<DetailLevel, WorldData>();

const sources: Record<DetailLevel, unknown> = {
  "110m": countries110,
  "50m": countries50,
};

export function getWorld(level: DetailLevel): WorldData {
  const cached = cache.get(level);
  if (cached) return cached;
  const data = build(sources[level]);
  cache.set(level, data);
  return data;
}
