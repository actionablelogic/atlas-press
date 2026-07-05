// Declarative style spec: a style is an ordered list of layers + paint props.
// Adding a new style is data (a new StyleDef), not renderer code — the renderer
// (src/render/renderMap.ts) knows this fixed vocabulary of layer types.

import type { TextureId } from "../render/RasterWarper";

export type StyleId =
  | "classicAtlas"
  | "minimal"
  | "terrain"
  | "satellite"
  // vector presets
  | "antiqueAtlas"
  | "blueprint"
  | "vintage"
  | "noir"
  | "boldPolitical"
  | "ink"
  | "midnight"
  // raster basemaps (city-level)
  | "street"
  | "light"
  | "dark"
  | "topographic"
  | "esriNatgeo"
  | "esriOcean"
  | "esriStreet";

export type LabelKind = "ocean" | "country" | "capital" | "city";

export interface LabelClass {
  kind: LabelKind;
  font: string; // css font-family list
  sizePx: number; // poster px (== css px in preview)
  weight?: number | string;
  italic?: boolean;
  color: string;
  halo?: string; // outline color for legibility over busy fills
  haloWidth?: number; // px, default 3
  uppercase?: boolean;
  smallCaps?: boolean;
  letterSpacing?: number; // px
  /** Only show this class once projection.scale() ≥ minScale. */
  minScale?: number;
  /** Lower = placed first when decluttering. */
  priority: number;
}

export type LayerType =
  | "background"
  | "sphere"
  | "raster"
  | "graticule"
  | "coastVignette"
  | "countries"
  | "land"
  | "borders"
  | "rivers"
  | "lakes"
  | "roads"
  | "labels";

export interface LayerSpec {
  type: LayerType;
  fill?: string;
  stroke?: string;
  lineWidth?: number;
  lineDash?: number[];
  opacity?: number;
  step?: number; // graticule degrees
  palette?: string[]; // countries political fill
  blur?: number; // coastVignette
  color?: string; // coastVignette glow color
  paper?: boolean; // background: subtle paper texture
  texture?: TextureId; // raster: equirectangular source (satellite/terrain)
  basemap?: string; // raster: tile source id (street/dark/topo…) for city detail
  labelClasses?: LabelClass[];
}

export interface StyleDef {
  id: StyleId;
  label: string;
  character: string;
  /** Sidebar grouping. */
  group: "vector" | "raster";
  layers: LayerSpec[];
}

// Muted, aged political palette (greedy coloring picks indices into this).
const ATLAS_PALETTE = [
  "#d8c7a3",
  "#c3d0b2",
  "#e2cbb0",
  "#c9c3b2",
  "#d6b9a1",
  "#bcccc6",
];

const CLASSIC_ATLAS: StyleDef = {
  id: "classicAtlas",
  label: "Classic Atlas",
  character: "Aged paper, political colors, serif labels",
  group: "vector",
  layers: [
    { type: "background", fill: "#efe6d2", paper: true },
    { type: "sphere", fill: "#a9c4d0", stroke: "#6b5b3f", lineWidth: 1.2 },
    { type: "graticule", stroke: "#b89e7a", lineWidth: 0.5, step: 15 },
    { type: "coastVignette", color: "rgba(88,66,40,0.45)", blur: 11 },
    { type: "countries", palette: ATLAS_PALETTE, stroke: "#a89572", lineWidth: 0.4 },
    { type: "land", stroke: "#7c6a4c", lineWidth: 0.7 }, // coastline
    { type: "rivers", stroke: "#8fb0c4", lineWidth: 0.6 },
    { type: "lakes", fill: "#a9c4d0", stroke: "#8fb0c4", lineWidth: 0.4 },
    {
      type: "labels",
      labelClasses: [
        {
          kind: "ocean",
          font: "'Iowan Old Style', Palatino, Georgia, serif",
          sizePx: 14,
          italic: true,
          color: "#5a6f7a",
          halo: "rgba(169,196,208,0.7)",
          uppercase: true,
          letterSpacing: 3,
          priority: 0,
        },
        {
          kind: "country",
          font: "'Iowan Old Style', Palatino, Georgia, serif",
          sizePx: 12,
          color: "#4a3f2c",
          halo: "rgba(239,230,210,0.85)",
          priority: 1,
        },
        {
          kind: "capital",
          font: "'Iowan Old Style', Palatino, Georgia, serif",
          sizePx: 10.5,
          color: "#2c2822",
          halo: "rgba(239,230,210,0.9)",
          minScale: 260,
          priority: 2,
        },
        {
          kind: "city",
          font: "'Iowan Old Style', Palatino, Georgia, serif",
          sizePx: 9.5,
          color: "#6b6152",
          halo: "rgba(239,230,210,0.9)",
          minScale: 700,
          priority: 3,
        },
      ],
    },
  ],
};

const MINIMAL: StyleDef = {
  id: "minimal",
  label: "Minimal",
  character: "Single-line coasts on a flat ground",
  group: "vector",
  layers: [
    { type: "background", fill: "#f4f1ea" },
    { type: "sphere", fill: "#f4f1ea", stroke: "#d3cabb", lineWidth: 1 },
    { type: "graticule", stroke: "#e4ded1", lineWidth: 0.4, step: 30 },
    { type: "land", stroke: "#33312c", lineWidth: 0.8 },
    { type: "borders", stroke: "#b3aa9c", lineWidth: 0.5 },
    {
      type: "labels",
      labelClasses: [
        {
          kind: "country",
          font: "'Inter', system-ui, sans-serif",
          sizePx: 11,
          color: "#5a564e",
          halo: "rgba(244,241,234,0.9)",
          letterSpacing: 0.5,
          priority: 1,
        },
      ],
    },
  ],
};

// Shared label set for raster styles; color/halo differ per underlay lightness.
function rasterLabels(text: string, halo: string): LabelClass[] {
  const font = "'Iowan Old Style', Palatino, Georgia, serif";
  return [
    {
      kind: "ocean",
      font,
      sizePx: 14,
      italic: true,
      color: text,
      halo,
      uppercase: true,
      letterSpacing: 3,
      priority: 0,
    },
    { kind: "country", font, sizePx: 12, color: text, halo, priority: 1 },
    {
      kind: "capital",
      font,
      sizePx: 10.5,
      color: text,
      halo,
      minScale: 260,
      priority: 2,
    },
  ];
}

const TERRAIN: StyleDef = {
  id: "terrain",
  label: "Terrain",
  character: "Natural Earth shaded relief",
  group: "raster",
  layers: [
    { type: "background", fill: "#dfe7e6" },
    { type: "sphere", fill: "#aac4cc", stroke: "#6b5b3f", lineWidth: 1.2 },
    { type: "raster", texture: "terrain" },
    { type: "graticule", stroke: "rgba(70,60,45,0.18)", lineWidth: 0.5, step: 15 },
    { type: "rivers", stroke: "rgba(70,105,130,0.7)", lineWidth: 0.6 },
    { type: "borders", stroke: "rgba(60,50,35,0.55)", lineWidth: 0.6 },
    {
      type: "labels",
      labelClasses: rasterLabels("#33302a", "rgba(233,231,222,0.85)"),
    },
  ],
};

const SATELLITE: StyleDef = {
  id: "satellite",
  label: "Satellite",
  character: "NASA Blue Marble (world scale)",
  group: "raster",
  layers: [
    { type: "background", fill: "#04070d" },
    { type: "sphere", fill: "#0a1a2e", stroke: "#3a4658", lineWidth: 1.2 },
    { type: "raster", texture: "satellite" },
    { type: "graticule", stroke: "rgba(255,255,255,0.12)", lineWidth: 0.5, step: 15 },
    { type: "borders", stroke: "rgba(255,240,210,0.5)", lineWidth: 0.6 },
    {
      type: "labels",
      labelClasses: rasterLabels("#f4efe4", "rgba(6,12,22,0.8)"),
    },
  ],
};

// --- shared label helpers -------------------------------------------
function serifLabels(color: string, halo: string, oceanColor = color): LabelClass[] {
  const font = "'EB Garamond', 'Iowan Old Style', Georgia, serif";
  return [
    { kind: "ocean", font, sizePx: 14, italic: true, color: oceanColor, halo, uppercase: true, letterSpacing: 3, priority: 0 },
    { kind: "country", font, sizePx: 12, color, halo, priority: 1 },
    { kind: "capital", font, sizePx: 10.5, color, halo, minScale: 260, priority: 2 },
    { kind: "city", font, sizePx: 9.5, color, halo, minScale: 700, priority: 3 },
  ];
}
function sansLabels(color: string, halo: string): LabelClass[] {
  const font = "'Inter', system-ui, sans-serif";
  return [
    { kind: "ocean", font, sizePx: 13, color, halo, uppercase: true, letterSpacing: 2, priority: 0 },
    { kind: "country", font, sizePx: 11, color, halo, letterSpacing: 0.5, priority: 1 },
    { kind: "capital", font, sizePx: 10, color, halo, minScale: 260, priority: 2 },
  ];
}

// --- vector presets -------------------------------------------------
const ANTIQUE_PALETTE = ["#d9c39a", "#c8cbb0", "#e0c7a4", "#cabf9f", "#d7b394", "#bfc9bd"];
const ANTIQUE_ATLAS: StyleDef = {
  id: "antiqueAtlas",
  label: "Antique Atlas",
  character: "Ornamental aged wall-map, heavy graticule",
  group: "vector",
  layers: [
    { type: "background", fill: "#efe1c4", paper: true },
    { type: "sphere", fill: "#bcd0cc", stroke: "#5a4a30", lineWidth: 1.6 },
    { type: "graticule", stroke: "#b09468", lineWidth: 0.6, step: 10 },
    { type: "coastVignette", color: "rgba(80,58,34,0.5)", blur: 14 },
    { type: "countries", palette: ANTIQUE_PALETTE, stroke: "#a0885f", lineWidth: 0.4 },
    { type: "land", stroke: "#6e5c3e", lineWidth: 0.9 },
    { type: "rivers", stroke: "#8aa6ba", lineWidth: 0.55 },
    { type: "lakes", fill: "#bcd0cc", stroke: "#8aa6ba", lineWidth: 0.4 },
    { type: "labels", labelClasses: serifLabels("#4a3a22", "rgba(239,225,196,0.85)", "#5f6f66") },
  ],
};

const BLUEPRINT: StyleDef = {
  id: "blueprint",
  label: "Blueprint",
  character: "Cyan linework on deep navy",
  group: "vector",
  layers: [
    { type: "background", fill: "#0e2a48" },
    { type: "sphere", fill: "#0e2a48", stroke: "#6f9dc9", lineWidth: 1 },
    { type: "graticule", stroke: "rgba(120,165,205,0.35)", lineWidth: 0.4, step: 15 },
    { type: "land", stroke: "#a9cdec", lineWidth: 0.7 },
    { type: "borders", stroke: "rgba(150,190,225,0.5)", lineWidth: 0.4, lineDash: [3, 3] },
    { type: "labels", labelClasses: sansLabels("#cfe3f6", "rgba(14,42,72,0.8)") },
  ],
};

const VINTAGE_PALETTE = ["#d8c6a0", "#cfc09a", "#e0cba6", "#d3bf98", "#dccca4", "#c9bd96"];
const VINTAGE: StyleDef = {
  id: "vintage",
  label: "Vintage",
  character: "Uniform sepia, soft and warm",
  group: "vector",
  layers: [
    { type: "background", fill: "#e8dcc0", paper: true },
    { type: "sphere", fill: "#cdbd9a", stroke: "#6b5638", lineWidth: 1.2 },
    { type: "graticule", stroke: "rgba(120,90,55,0.3)", lineWidth: 0.4, step: 15 },
    { type: "coastVignette", color: "rgba(90,66,38,0.4)", blur: 10 },
    { type: "countries", palette: VINTAGE_PALETTE, stroke: "#a58c63", lineWidth: 0.4 },
    { type: "land", stroke: "#7a6242", lineWidth: 0.7 },
    { type: "labels", labelClasses: serifLabels("#5a4326", "rgba(232,220,192,0.85)") },
  ],
};

const NOIR: StyleDef = {
  id: "noir",
  label: "Noir",
  character: "High-contrast monochrome",
  group: "vector",
  layers: [
    { type: "background", fill: "#f0f0ee" },
    { type: "sphere", fill: "#d9d9d6", stroke: "#1a1a1a", lineWidth: 1.4 },
    { type: "graticule", stroke: "rgba(0,0,0,0.08)", lineWidth: 0.4, step: 20 },
    { type: "land", fill: "#bdbdb9", stroke: "#141414", lineWidth: 0.9 },
    { type: "borders", stroke: "#6a6a66", lineWidth: 0.5 },
    { type: "labels", labelClasses: sansLabels("#111111", "rgba(240,240,238,0.9)") },
  ],
};

const BOLD_PALETTE = ["#e8b4a0", "#a9cf9e", "#f0d79a", "#a9c0e0", "#d4a9d0", "#9fd4cc"];
const BOLD_POLITICAL: StyleDef = {
  id: "boldPolitical",
  label: "Bold Political",
  character: "Saturated fills, strong borders",
  group: "vector",
  layers: [
    { type: "background", fill: "#f5f2ea" },
    { type: "sphere", fill: "#bcd8e6", stroke: "#2a2a2a", lineWidth: 1.4 },
    { type: "graticule", stroke: "rgba(40,40,40,0.1)", lineWidth: 0.4, step: 15 },
    { type: "countries", palette: BOLD_PALETTE, stroke: "#333333", lineWidth: 0.5 },
    { type: "land", stroke: "#1f1f1f", lineWidth: 0.8 },
    { type: "borders", stroke: "#1f1f1f", lineWidth: 1 },
    { type: "labels", labelClasses: serifLabels("#1a1a1a", "rgba(245,242,234,0.9)", "#2a5f74") },
  ],
};

const INK: StyleDef = {
  id: "ink",
  label: "Ink",
  character: "Fine pen-and-ink linework on cream",
  group: "vector",
  layers: [
    { type: "background", fill: "#f4efe1", paper: true },
    { type: "sphere", fill: "#faf6ec", stroke: "#1a1a1a", lineWidth: 1.1 },
    { type: "graticule", stroke: "rgba(0,0,0,0.07)", lineWidth: 0.35, step: 15 },
    { type: "land", stroke: "#1a1a1a", lineWidth: 0.6 },
    { type: "rivers", stroke: "#555555", lineWidth: 0.4 },
    { type: "borders", stroke: "#1a1a1a", lineWidth: 0.4, lineDash: [2, 2] },
    { type: "labels", labelClasses: serifLabels("#1a1a1a", "rgba(250,246,236,0.85)") },
  ],
};

const MIDNIGHT: StyleDef = {
  id: "midnight",
  label: "Midnight",
  character: "Moody dark-blue vector globe",
  group: "vector",
  layers: [
    { type: "background", fill: "#0b0f1a" },
    { type: "sphere", fill: "#0e1524", stroke: "#33465e", lineWidth: 1.3 },
    { type: "graticule", stroke: "rgba(130,160,200,0.12)", lineWidth: 0.4, step: 15 },
    { type: "countries", palette: ["#1a2436", "#1d2a3c", "#202333", "#233040", "#1c2738", "#242c3e"], stroke: "#33445e", lineWidth: 0.4 },
    { type: "land", stroke: "#3a4d6b", lineWidth: 0.6 },
    { type: "rivers", stroke: "#2f4a66", lineWidth: 0.5 },
    { type: "borders", stroke: "#38495f", lineWidth: 0.5 },
    { type: "labels", labelClasses: sansLabels("#a9c0dd", "rgba(11,15,26,0.85)") },
  ],
};

// --- raster basemaps (city-level tiles over a vector world base) -----
interface BasemapColors {
  bg: string;
  ocean: string;
  land: string;
  coast: string;
  border: string;
  outline: string;
  grat: string;
}
function basemapStyle(
  id: StyleId,
  label: string,
  character: string,
  source: string,
  c: BasemapColors,
): StyleDef {
  return {
    id,
    label,
    character,
    group: "raster",
    layers: [
      { type: "background", fill: c.bg },
      { type: "sphere", fill: c.ocean, stroke: c.outline, lineWidth: 1.2 },
      { type: "graticule", stroke: c.grat, lineWidth: 0.4, step: 15 },
      { type: "land", fill: c.land, stroke: c.coast, lineWidth: 0.5 },
      { type: "borders", stroke: c.border, lineWidth: 0.5 },
      // Region-scale tiles overlay the vector base (which shows at world scale).
      { type: "raster", basemap: source },
    ],
  };
}

const STREET = basemapStyle("street", "Street", "OSM street map — city level", "carto-voyager", {
  bg: "#e9e5dc", ocean: "#a9c9dd", land: "#e6e2d6", coast: "#c4bdac", border: "#cfc7b6", outline: "#8a7f68", grat: "rgba(90,80,60,0.14)",
});
const LIGHT = basemapStyle("light", "Light", "Muted light basemap — city level", "carto-positron", {
  bg: "#f2f2f0", ocean: "#dde6ea", land: "#ececeb", coast: "#d5d5d1", border: "#dadad6", outline: "#c4c4c0", grat: "rgba(120,120,120,0.12)",
});
const DARK = basemapStyle("dark", "Dark", "Dark basemap — city level", "carto-dark", {
  bg: "#0f1216", ocean: "#0d151d", land: "#1c222a", coast: "#2c333c", border: "#333a43", outline: "#3a4048", grat: "rgba(200,210,220,0.08)",
});
const TOPOGRAPHIC = basemapStyle("topographic", "Topographic", "Contours & relief — city level", "esri-topo", {
  bg: "#e8e3d4", ocean: "#a9c9dd", land: "#ded8c4", coast: "#bdb59e", border: "#c3bba4", outline: "#8a7f68", grat: "rgba(90,80,60,0.14)",
});
const ESRI_NATGEO = basemapStyle("esriNatgeo", "NatGeo", "National-Geographic look — city level", "esri-natgeo", {
  bg: "#efe6d0", ocean: "#c9dbe0", land: "#e4dcc4", coast: "#b8ac8e", border: "#c7bda0", outline: "#8a7f68", grat: "rgba(90,80,60,0.14)",
});
const ESRI_OCEAN = basemapStyle("esriOcean", "Ocean", "Bathymetry base — city level", "esri-ocean", {
  bg: "#dbe8ee", ocean: "#a9c9dd", land: "#e8e4d8", coast: "#c9c2b2", border: "#cfc7b6", outline: "#6b7f8a", grat: "rgba(60,90,110,0.14)",
});
const ESRI_STREET = basemapStyle("esriStreet", "Streets (Esri)", "Esri street map — city level", "esri-street", {
  bg: "#eeeae0", ocean: "#bcd4de", land: "#eae6da", coast: "#cfc8b8", border: "#d3ccbb", outline: "#8a7f68", grat: "rgba(90,80,60,0.12)",
});

export const STYLES: StyleDef[] = [
  CLASSIC_ATLAS,
  MINIMAL,
  ANTIQUE_ATLAS,
  BLUEPRINT,
  VINTAGE,
  NOIR,
  BOLD_POLITICAL,
  INK,
  MIDNIGHT,
  TERRAIN,
  SATELLITE,
  STREET,
  LIGHT,
  DARK,
  TOPOGRAPHIC,
  ESRI_NATGEO,
  ESRI_OCEAN,
  ESRI_STREET,
];

export const STYLES_BY_ID: Record<StyleId, StyleDef> = Object.fromEntries(
  STYLES.map((s) => [s.id, s]),
) as Record<StyleId, StyleDef>;

export function getStyleDef(id: StyleId): StyleDef {
  return STYLES_BY_ID[id];
}
