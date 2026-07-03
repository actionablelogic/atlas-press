// Declarative style spec: a style is an ordered list of layers + paint props.
// Adding a new style is data (a new StyleDef), not renderer code — the renderer
// (src/render/renderMap.ts) knows this fixed vocabulary of layer types.

export type StyleId = "classicAtlas" | "minimal";

export type LabelKind = "ocean" | "country" | "capital" | "city";

export interface LabelClass {
  kind: LabelKind;
  font: string; // css font-family list
  sizePx: number; // poster px (== css px in preview)
  weight?: number | string;
  italic?: boolean;
  color: string;
  halo?: string; // outline color for legibility over busy fills
  uppercase?: boolean;
  letterSpacing?: number; // px
  /** Only show this class once projection.scale() ≥ minScale. */
  minScale?: number;
  /** Lower = placed first when decluttering. */
  priority: number;
}

export type LayerType =
  | "background"
  | "sphere"
  | "graticule"
  | "coastVignette"
  | "countries"
  | "land"
  | "borders"
  | "rivers"
  | "lakes"
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
  labelClasses?: LabelClass[];
}

export interface StyleDef {
  id: StyleId;
  label: string;
  character: string;
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

export const STYLES: StyleDef[] = [CLASSIC_ATLAS, MINIMAL];

export const STYLES_BY_ID: Record<StyleId, StyleDef> = Object.fromEntries(
  STYLES.map((s) => [s.id, s]),
) as Record<StyleId, StyleDef>;

export function getStyleDef(id: StyleId): StyleDef {
  return STYLES_BY_ID[id];
}
