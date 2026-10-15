import type { FeatureCollection, Geometry } from "geojson";

// Natural Earth 10m major highways (public domain). This is the only NE scale
// with roads and it's a heavier asset (~2.3 MB filtered), so it's served from
// /public and lazy-loaded the first time the roads layer is switched on — never
// bundled, never fetched unless requested. (PRD.md §5.4 / §8.)

let roads: FeatureCollection<Geometry> | null = null;
let loading = false;
const waiters: Array<() => void> = [];

const URL = `${import.meta.env.BASE_URL}data/roads.json`;

/** Synchronous accessor for the renderer; null until loaded. */
export function getRoadsSync(): FeatureCollection<Geometry> | null {
  return roads;
}

/** Kick off the one-time fetch; `onReady` fires (once) when data is available. */
export function ensureRoads(onReady?: () => void): FeatureCollection<Geometry> | null {
  if (roads) return roads;
  if (onReady) waiters.push(onReady);
  if (loading) return null;
  loading = true;
  fetch(URL)
    .then((r) => r.json())
    .then((json: FeatureCollection<Geometry>) => {
      roads = json;
      loading = false;
      waiters.splice(0).forEach((f) => f());
    })
    .catch(() => {
      loading = false;
      console.warn("roads: failed to load", URL);
    });
  return null;
}
