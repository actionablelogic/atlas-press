// Pluggable Web-Mercator XYZ tile sources for region-scale satellite (M4b).
// Licensing matters (PRD.md §8): the default (EOX Sentinel-2 cloudless) is
// CC-BY-NC-SA — non-commercial. The UI shows the active source's attribution +
// license next to export. A user can bring a commercially-licensed source/key.

/**
 * Licence terms governing posters made with a source (PRD.md §8):
 *  - "open"            public domain / free for any use, no conditions
 *  - "attribution"     free to use, attribution required; provider terms apply
 *  - "non-commercial"  licence excludes commercial use (e.g. CC BY-NC-SA)
 *  - "unknown"         depends on the user's own source terms
 */
export type UsageTerms = "open" | "attribution" | "non-commercial" | "unknown";

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
  /** Licence terms for posters made with these tiles. */
  terms: UsageTerms;
  /** One-line notice of the licence conditions. */
  usageNote: string;
  /** "imagery" = satellite tier; "basemap" = street/topo/etc. map tiles. */
  kind: "imagery" | "basemap";
  /** True → needs the user's apiKey filled in before use. */
  requiresKey?: boolean;
}

const CARTO = (id: string) =>
  `https://basemaps.cartocdn.com/rastertiles/${id}/{z}/{x}/{y}.png`;

/** Free-to-use basemap tile sources for city-level detail (all CORS-open). */
export const BASEMAP_SOURCES: TileSource[] = [
  {
    id: "carto-voyager",
    label: "Street (CARTO Voyager)",
    urlTemplate: CARTO("voyager"),
    minZoom: 0,
    maxZoom: 20,
    tileSize: 256,
    attribution: "© OpenStreetMap contributors © CARTO",
    license: "CARTO basemaps — free with attribution",
    terms: "attribution",
    usageNote: "Attribution required (OpenStreetMap ODbL + CARTO). Use subject to CARTO's terms of service.",
    kind: "basemap",
  },
  {
    id: "carto-positron",
    label: "Light (CARTO Positron)",
    urlTemplate: CARTO("light_all"),
    minZoom: 0,
    maxZoom: 20,
    tileSize: 256,
    attribution: "© OpenStreetMap contributors © CARTO",
    license: "CARTO basemaps — free with attribution",
    terms: "attribution",
    usageNote: "Attribution required (OpenStreetMap ODbL + CARTO). Use subject to CARTO's terms of service.",
    kind: "basemap",
  },
  {
    id: "carto-dark",
    label: "Dark (CARTO Dark Matter)",
    urlTemplate: CARTO("dark_all"),
    minZoom: 0,
    maxZoom: 20,
    tileSize: 256,
    attribution: "© OpenStreetMap contributors © CARTO",
    license: "CARTO basemaps — free with attribution",
    terms: "attribution",
    usageNote: "Attribution required (OpenStreetMap ODbL + CARTO). Use subject to CARTO's terms of service.",
    kind: "basemap",
  },
  {
    id: "esri-topo",
    label: "Topographic (Esri)",
    urlTemplate:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    attribution: "Esri, HERE, Garmin, USGS, NGA",
    license: "Esri — attribution required; see Esri terms for print",
    terms: "attribution",
    usageNote: "Attribution required. Use subject to Esri's terms of use.",
    kind: "basemap",
  },
  {
    id: "esri-natgeo",
    label: "NatGeo (Esri)",
    urlTemplate:
      "https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}",
    minZoom: 0,
    maxZoom: 16,
    tileSize: 256,
    attribution: "National Geographic, Esri, Garmin, HERE, USGS, NASA",
    license: "Esri / NatGeo — attribution required; see terms for print",
    terms: "attribution",
    usageNote: "Attribution required. Use subject to Esri and National Geographic terms of use.",
    kind: "basemap",
  },
  {
    id: "esri-ocean",
    label: "Ocean (Esri)",
    urlTemplate:
      "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
    minZoom: 0,
    maxZoom: 16,
    tileSize: 256,
    attribution: "Esri, GEBCO, NOAA, National Geographic, Garmin, HERE",
    license: "Esri — attribution required; see Esri terms for print",
    terms: "attribution",
    usageNote: "Attribution required. Use subject to Esri's terms of use.",
    kind: "basemap",
  },
  {
    id: "esri-street",
    label: "Streets (Esri)",
    urlTemplate:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    attribution: "Esri, HERE, Garmin, USGS, NGA, OpenStreetMap contributors",
    license: "Esri — attribution required; see Esri terms for print",
    terms: "attribution",
    usageNote: "Attribution required. Use subject to Esri's terms of use.",
    kind: "basemap",
  },
];

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
    terms: "non-commercial",
    usageNote: "Licensed CC BY-NC-SA 4.0: attribution required, non-commercial use only, derivatives under the same licence.",
    kind: "imagery",
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
    terms: "attribution",
    usageNote: "Attribution required. Use subject to Esri's terms of use.",
    kind: "imagery",
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
    terms: "unknown",
    usageNote: "Use is governed by your tile source's licence.",
    kind: "imagery",
    requiresKey: true,
  },
];

/** Every registered source (imagery + basemap), keyed by id. */
export const TILE_SOURCES_BY_ID: Record<string, TileSource> = Object.fromEntries(
  [...TILE_SOURCES, ...BASEMAP_SOURCES].map((s) => [s.id, s]),
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
