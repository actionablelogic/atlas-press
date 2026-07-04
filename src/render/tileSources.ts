// Pluggable Web-Mercator XYZ tile sources for region-scale satellite (M4b).
// Licensing matters (prj.md §8): the default (EOX Sentinel-2 cloudless) is
// CC-BY-NC-SA — non-commercial. The UI shows the active source's attribution +
// license next to export. A user can bring a commercially-licensed source/key.

export interface TileSource {
  id: string;
  label: string;
  /** URL template with {z} {x} {y} and optional {key}. */
  urlTemplate: string;
  minZoom: number;
  maxZoom: number;
  tileSize: number;
  attribution: string;
  /** Short license note surfaced in the UI. */
  license: string;
  /** True → needs the user's apiKey filled in before use. */
  requiresKey?: boolean;
}

export const TILE_SOURCES: TileSource[] = [
  {
    id: "eox-s2cloudless",
    label: "Sentinel-2 cloudless (EOX)",
    urlTemplate:
      "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg",
    minZoom: 0,
    maxZoom: 15,
    tileSize: 256,
    attribution: "Sentinel-2 cloudless 2020 by EOX IT Services GmbH",
    license: "CC-BY-NC-SA 4.0 — non-commercial",
  },
  {
    id: "esri-world-imagery",
    label: "Esri World Imagery",
    urlTemplate:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    attribution: "Esri, Maxar, Earthstar Geographics",
    license: "Esri — attribution required; see Esri terms for print",
  },
  {
    id: "custom",
    label: "Custom (your source / key)",
    urlTemplate: "",
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    attribution: "User-supplied source",
    license: "Per your source's terms",
    requiresKey: true,
  },
];

export const TILE_SOURCES_BY_ID: Record<string, TileSource> = Object.fromEntries(
  TILE_SOURCES.map((s) => [s.id, s]),
);

export function tileUrl(
  source: TileSource,
  z: number,
  x: number,
  y: number,
  key?: string,
  customTemplate?: string,
): string {
  const tpl = source.id === "custom" ? customTemplate ?? "" : source.urlTemplate;
  return tpl
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y))
    .replace("{key}", key ?? "");
}
