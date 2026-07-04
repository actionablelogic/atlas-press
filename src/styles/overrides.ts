// User customizations layered on top of a style preset (prj.md §5.4). A style
// is a preset + this diff; the renderer only ever sees the resolved StyleDef
// produced by applyOverrides(). Stored in MapDocument as `styleOverrides`.

import type {
  LabelClass,
  LabelKind,
  LayerSpec,
  LayerType,
  StyleDef,
} from "./styles";

export type ToggleKey =
  | "borders"
  | "fills"
  | "coastline"
  | "rivers"
  | "lakes"
  | "roads"
  | "graticule"
  | "countryNames"
  | "capitals"
  | "cities"
  | "oceanNames";

/** Toggle keys that correspond to a paintable vector layer. */
export type PaintKey =
  | "borders"
  | "fills"
  | "coastline"
  | "rivers"
  | "lakes"
  | "roads"
  | "graticule";

export interface LayerPaintOverride {
  color?: string;
  width?: number;
}

export interface TypeOverride {
  font?: string;
  sizeScale?: number;
  color?: string;
  halo?: string;
  letterSpacing?: number;
  smallCaps?: boolean;
}

export interface StyleOverrides {
  toggles?: Partial<Record<ToggleKey, boolean>>;
  paint?: Partial<Record<PaintKey, LayerPaintOverride>>;
  background?: string;
  ocean?: string;
  /** Applied to every label class first (the "link all" control). */
  typeAll?: TypeOverride;
  type?: Partial<Record<LabelKind, TypeOverride>>;
}

export const EMPTY_OVERRIDES: StyleOverrides = {};

// --- toggle ↔ layer/label mapping ------------------------------------
const LAYER_TOGGLE: Partial<Record<LayerType, PaintKey>> = {
  borders: "borders",
  countries: "fills",
  land: "coastline",
  rivers: "rivers",
  lakes: "lakes",
  roads: "roads",
  graticule: "graticule",
};

const LABEL_TOGGLE: Record<LabelKind, ToggleKey> = {
  country: "countryNames",
  capital: "capitals",
  city: "cities",
  ocean: "oceanNames",
};

// Render order (bottom → top) for the toggleable content layers.
const CONTENT_ORDER: LayerType[] = [
  "graticule",
  "coastVignette",
  "countries",
  "land",
  "lakes",
  "rivers",
  "roads",
  "borders",
];

const DEFAULT_PALETTE = ["#d8c7a3", "#c3d0b2", "#e2cbb0", "#c9c3b2", "#d6b9a1", "#bcccc6"];

// Defaults used when a layer is toggled ON but the preset doesn't include it.
const LAYER_CATALOG: Record<PaintKey, LayerSpec> = {
  borders: { type: "borders", stroke: "#8a7f68", lineWidth: 0.6 },
  fills: { type: "countries", palette: DEFAULT_PALETTE, stroke: "#a89572", lineWidth: 0.4 },
  coastline: { type: "land", stroke: "#5a5348", lineWidth: 0.7 },
  rivers: { type: "rivers", stroke: "#8fb0c4", lineWidth: 0.6 },
  lakes: { type: "lakes", fill: "#a9c4d0", stroke: "#8fb0c4", lineWidth: 0.4 },
  roads: { type: "roads", stroke: "#9c5636", lineWidth: 0.55 },
  graticule: { type: "graticule", stroke: "#9fb2b8", lineWidth: 0.5, step: 15 },
};

const LABEL_DEFAULTS: Record<LabelKind, Omit<LabelClass, "font" | "color">> = {
  ocean: { kind: "ocean", sizePx: 14, italic: true, uppercase: true, letterSpacing: 3, priority: 0 },
  country: { kind: "country", sizePx: 12, priority: 1 },
  capital: { kind: "capital", sizePx: 10.5, minScale: 260, priority: 2 },
  city: { kind: "city", sizePx: 9.5, minScale: 700, priority: 3 },
};

const LABEL_KINDS: LabelKind[] = ["ocean", "country", "capital", "city"];

// --- lookups the Customize UI uses to show current values ------------
export function presetLayer(preset: StyleDef, type: LayerType): LayerSpec | undefined {
  return preset.layers.find((l) => l.type === type);
}

export function presetLabelClass(preset: StyleDef, kind: LabelKind): LabelClass | undefined {
  return preset.layers
    .find((l) => l.type === "labels")
    ?.labelClasses?.find((c) => c.kind === kind);
}

export function toggleDefault(preset: StyleDef, key: ToggleKey): boolean {
  if (key in LABEL_TOGGLE || LABEL_KINDS.some((k) => LABEL_TOGGLE[k] === key)) {
    const kind = LABEL_KINDS.find((k) => LABEL_TOGGLE[k] === key);
    return kind ? presetLabelClass(preset, kind) != null : false;
  }
  const type = (Object.keys(LAYER_TOGGLE) as LayerType[]).find(
    (t) => LAYER_TOGGLE[t] === key,
  );
  return type ? presetLayer(preset, type) != null : false;
}

export function effectiveToggle(
  preset: StyleDef,
  ov: StyleOverrides,
  key: ToggleKey,
): boolean {
  return ov.toggles?.[key] ?? toggleDefault(preset, key);
}

/** Does this preset use a raster underlay (→ political fills don't apply)? */
export function isRasterPreset(preset: StyleDef): boolean {
  return preset.layers.some((l) => l.type === "raster");
}

const TYPE_FOR_PAINT: Record<PaintKey, LayerType> = {
  borders: "borders",
  fills: "countries",
  coastline: "land",
  rivers: "rivers",
  lakes: "lakes",
  roads: "roads",
  graticule: "graticule",
};

/** Effective color + width for a paint layer (override → preset → catalog). */
export function resolvePaint(
  preset: StyleDef,
  ov: StyleOverrides,
  key: PaintKey,
): { color: string; width: number } {
  const po = ov.paint?.[key];
  const base = presetLayer(preset, TYPE_FOR_PAINT[key]) ?? LAYER_CATALOG[key];
  const rawColor =
    key === "fills"
      ? base.fill ?? base.palette?.[0] ?? "#cccccc"
      : base.stroke ?? "#888888";
  return {
    color: po?.color ?? rawColor,
    width: po?.width ?? base.lineWidth ?? 0.6,
  };
}

export interface ResolvedType {
  font: string;
  sizeScale: number;
  color: string;
  halo: string;
  letterSpacing: number;
  smallCaps: boolean;
}

/** Effective typography for a label class (override → preset → defaults). */
export function resolveType(
  preset: StyleDef,
  ov: StyleOverrides,
  kind: LabelKind,
): ResolvedType {
  const template = preset.layers.find((l) => l.type === "labels")?.labelClasses?.[0];
  const base =
    presetLabelClass(preset, kind) ??
    ({
      ...LABEL_DEFAULTS[kind],
      font: template?.font ?? "Georgia, serif",
      color: template?.color ?? "#333333",
    } as LabelClass);
  const merged: TypeOverride = { ...ov.typeAll, ...ov.type?.[kind] };
  return {
    font: merged.font ?? base.font,
    sizeScale: merged.sizeScale ?? 1,
    color: merged.color ?? base.color,
    halo: merged.halo ?? base.halo ?? "#ffffff",
    letterSpacing: merged.letterSpacing ?? base.letterSpacing ?? 0,
    smallCaps: merged.smallCaps ?? base.smallCaps ?? false,
  };
}

// --- resolve preset + overrides → effective StyleDef -----------------
function clone<T>(v: T): T {
  return structuredClone(v);
}

function applyType(cls: LabelClass, ov: StyleOverrides): LabelClass {
  const merged: TypeOverride = { ...ov.typeAll, ...ov.type?.[cls.kind] };
  if (Object.keys(merged).length === 0) return cls;
  return {
    ...cls,
    font: merged.font ?? cls.font,
    color: merged.color ?? cls.color,
    halo: merged.halo ?? cls.halo,
    letterSpacing: merged.letterSpacing ?? cls.letterSpacing,
    smallCaps: merged.smallCaps ?? cls.smallCaps,
    sizePx: cls.sizePx * (merged.sizeScale ?? 1),
  };
}

export function applyOverrides(preset: StyleDef, ov: StyleOverrides): StyleDef {
  const toggles = ov.toggles ?? {};
  const paint = ov.paint ?? {};
  const byType = new Map<LayerType, LayerSpec>();
  for (const l of preset.layers) if (!byType.has(l.type)) byType.set(l.type, l);

  const out: LayerSpec[] = [];

  const bg = byType.get("background");
  if (bg) {
    const l = clone(bg);
    if (ov.background) l.fill = ov.background;
    out.push(l);
  }
  const sphere = byType.get("sphere");
  if (sphere) {
    const l = clone(sphere);
    if (ov.ocean) l.fill = ov.ocean;
    out.push(l);
  }
  const raster = byType.get("raster");
  if (raster) out.push(clone(raster));

  for (const type of CONTENT_ORDER) {
    if (type === "coastVignette") {
      const cv = byType.get("coastVignette");
      if (cv) out.push(clone(cv));
      continue;
    }
    const key = LAYER_TOGGLE[type]!;
    const inPreset = byType.get(type);
    const on = toggles[key] ?? inPreset != null;
    if (!on) continue;
    const layer = clone(inPreset ?? LAYER_CATALOG[key]);
    const po = paint[key];
    if (po) {
      if (po.width != null) layer.lineWidth = po.width;
      if (po.color != null) {
        if (type === "countries") layer.fill = po.color; // flat land color
        else layer.stroke = po.color;
      }
    }
    out.push(layer);
  }

  // Labels: build from the toggleable kinds so classes can be added or removed.
  const labelsLayer = byType.get("labels");
  const template =
    labelsLayer?.labelClasses?.[0] ??
    ({ font: "Georgia, serif", color: "#333" } as LabelClass);
  const classes: LabelClass[] = [];
  for (const kind of LABEL_KINDS) {
    const on = toggles[LABEL_TOGGLE[kind]] ?? presetLabelClass(preset, kind) != null;
    if (!on) continue;
    const base =
      presetLabelClass(preset, kind) ??
      ({
        ...LABEL_DEFAULTS[kind],
        font: template.font,
        color: template.color,
        halo: template.halo,
      } as LabelClass);
    classes.push(applyType(base, ov));
  }
  if (classes.length) out.push({ type: "labels", labelClasses: classes });

  return { ...preset, layers: out };
}
