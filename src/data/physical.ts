import type { FeatureCollection, Geometry } from "geojson";
import lakesRaw from "./ne_110m_lakes.json";
import riversRaw from "./ne_110m_rivers_lake_centerlines.json";
import placesRaw from "./ne_110m_populated_places_simple.json";

// Natural Earth 110m physical + cultural layers (public domain). Bundled for
// M3; candidates for lazy-loading later (see status.md follow-ups).
export const lakes = lakesRaw as unknown as FeatureCollection<Geometry>;
export const rivers = riversRaw as unknown as FeatureCollection<Geometry>;

export interface Place {
  name: string;
  lon: number;
  lat: number;
  isCapital: boolean;
  pop: number;
}

interface RawPlace {
  properties: { name: string; adm0cap: number; pop_max?: number };
  geometry: { coordinates: [number, number] };
}

export const places: Place[] = (
  placesRaw as unknown as { features: RawPlace[] }
).features.map((f) => ({
  name: f.properties.name,
  lon: f.geometry.coordinates[0],
  lat: f.geometry.coordinates[1],
  isCapital: f.properties.adm0cap === 1,
  pop: f.properties.pop_max ?? 0,
}));
