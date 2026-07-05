// Pluggable Web-Mercator XYZ tile sources for region-scale satellite (M4b).
// Licensing matters (prj.md §8): the default (EOX Sentinel-2 cloudless) is
// CC-BY-NC-SA — non-commercial. The UI shows the active source's attribution +
// license next to export. A user can bring a commercially-licensed source/key.

/**
 * Commercial-use classification for the printed poster (prj.md §8):
 *  - "sellable"     freely sellable (public domain / free incl. commercial)
 *  - "attribution"  sellable but attribution required — verify provider's print
 *                   terms (some providers restrict commercial/print use)
 *  - "personal"     personal use only (e.g. CC-BY-NC-SA — no commercial resale)
 *  - "unknown"      depends on the user's own source terms
 */
export type CommercialUse = "sellable" | "attribution" | "personal" | "unknown";

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
  /** Commercial-use classification for prints made with these tiles. */
  commercial: CommercialUse;
  /** One-line explanation of the commercial terms. */
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
    commercial: "attribution",
    usageNote: "Attribution required (OpenStreetMap ODbL + CARTO); heavy or commercial use may need a CARTO plan.",
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
    commercial: "attribution",
    usageNote: "Attribution required (OpenStreetMap ODbL + CARTO); heavy or commercial use may need a CARTO plan.",
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
    commercial: "attribution",
    usageNote: "Attribution required (OpenStreetMap ODbL + CARTO); heavy or commercial use may need a CARTO plan.",
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
    commercial: "attribution",
    usageNote: "Attribution required; verify Esri's terms before selling prints.",
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
    commercial: "personal",
    usageNote: "Personal use only — no commercial resale of prints (CC-BY-NC-SA).",
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
    commercial: "attribution",
    usageNote: "Attribution required; verify Esri's terms before selling prints.",
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
    commercial: "unknown",
    usageNote: "Rights depend entirely on your tile source's licence.",
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
