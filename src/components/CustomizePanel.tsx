import type { LabelKind, StyleDef } from "../styles/styles";
import { FONTS } from "../styles/fonts";
import {
  effectiveToggle,
  isRasterPreset,
  resolvePaint,
  resolveType,
  type PaintKey,
  type StyleOverrides,
  type ToggleKey,
  type TypeOverride,
} from "../styles/overrides";

interface Props {
  preset: StyleDef;
  overrides: StyleOverrides;
  onChange: (next: StyleOverrides) => void;
  onReset: () => void;
}

const LAYER_TOGGLES: Array<{ key: ToggleKey; label: string }> = [
  { key: "borders", label: "Country borders" },
  { key: "fills", label: "Political fills" },
  { key: "coastline", label: "Coastline" },
  { key: "rivers", label: "Rivers" },
  { key: "lakes", label: "Lakes" },
  { key: "roads", label: "Roads (10m)" },
  { key: "graticule", label: "Graticule" },
];

const LABEL_TOGGLES: Array<{ key: ToggleKey; label: string }> = [
  { key: "countryNames", label: "Country names" },
  { key: "capitals", label: "Capitals" },
  { key: "cities", label: "Major cities" },
  { key: "oceanNames", label: "Ocean names" },
];

const PAINT_LAYERS: Array<{ key: PaintKey; label: string }> = [
  { key: "fills", label: "Land fill" },
  { key: "coastline", label: "Coastline" },
  { key: "borders", label: "Borders" },
  { key: "rivers", label: "Rivers" },
  { key: "roads", label: "Roads" },
  { key: "graticule", label: "Graticule" },
];

const TYPE_CLASSES: Array<{ kind: LabelKind; label: string }> = [
  { kind: "country", label: "Country names" },
  { kind: "capital", label: "Capitals" },
  { kind: "city", label: "Cities" },
  { kind: "ocean", label: "Ocean names" },
];

function toHex(c: string): string {
  if (c.startsWith("#")) return c.slice(0, 7);
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return "#888888";
  const [r, g, b] = m[1].split(",").map((s) => parseInt(s.trim(), 10));
  return (
    "#" +
    [r, g, b].map((v) => (v || 0).toString(16).padStart(2, "0")).join("")
  );
}

export function CustomizePanel({ preset, overrides, onChange, onReset }: Props) {
  const raster = isRasterPreset(preset);

  const setToggle = (key: ToggleKey, val: boolean) =>
    onChange({ ...overrides, toggles: { ...overrides.toggles, [key]: val } });

  const setPaint = (key: PaintKey, field: "color" | "width", val: string | number) =>
    onChange({
      ...overrides,
      paint: {
        ...overrides.paint,
        [key]: { ...overrides.paint?.[key], [field]: val },
      },
    });

  const setType = (kind: LabelKind, patch: Partial<TypeOverride>) =>
    onChange({
      ...overrides,
      type: { ...overrides.type, [kind]: { ...overrides.type?.[kind], ...patch } },
    });

  const dirty =
    Object.keys(overrides.toggles ?? {}).length > 0 ||
    Object.keys(overrides.paint ?? {}).length > 0 ||
    Object.keys(overrides.type ?? {}).length > 0 ||
    overrides.typeAll != null ||
    overrides.background != null ||
    overrides.ocean != null;

  return (
    <details className="customize">
      <summary className="picker-title customize-summary">
        Customize {dirty && <span className="dot" title="Customized" />}
      </summary>

      <div className="customize-body">
        {/* Layers */}
        <details open className="cz-section">
          <summary>Layers</summary>
          <div className="cz-toggles">
            {LAYER_TOGGLES.map(({ key, label }) => {
              const disabled = raster && key === "fills";
              return (
                <label key={key} className={`cz-check${disabled ? " is-disabled" : ""}`}>
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={!disabled && effectiveToggle(preset, overrides, key)}
                    onChange={(e) => setToggle(key, e.target.checked)}
                  />
                  {label}
                </label>
              );
            })}
          </div>
          <div className="cz-sub">Labels</div>
          <div className="cz-toggles">
            {LABEL_TOGGLES.map(({ key, label }) => (
              <label key={key} className="cz-check">
                <input
                  type="checkbox"
                  checked={effectiveToggle(preset, overrides, key)}
                  onChange={(e) => setToggle(key, e.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
        </details>

        {/* Colors */}
        <details className="cz-section">
          <summary>Colors & widths</summary>
          <div className="cz-rows">
            <ColorRow
              label="Background"
              value={toHex(overrides.background ?? preset.layers.find((l) => l.type === "background")?.fill ?? "#efe6d2")}
              onChange={(v) => onChange({ ...overrides, background: v })}
            />
            <ColorRow
              label="Ocean"
              value={toHex(overrides.ocean ?? preset.layers.find((l) => l.type === "sphere")?.fill ?? "#a9c4d0")}
              onChange={(v) => onChange({ ...overrides, ocean: v })}
            />
            {PAINT_LAYERS.map(({ key, label }) => {
              if (raster && key === "fills") return null;
              const { color, width } = resolvePaint(preset, overrides, key);
              return (
                <div className="cz-paint" key={key}>
                  <span className="cz-paint-label">{label}</span>
                  <input
                    type="color"
                    value={toHex(color)}
                    onChange={(e) => setPaint(key, "color", e.target.value)}
                  />
                  {key !== "fills" && (
                    <input
                      className="cz-range"
                      type="range"
                      min={0.1}
                      max={4}
                      step={0.1}
                      value={width}
                      onChange={(e) => setPaint(key, "width", Number(e.target.value))}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </details>

        {/* Typography */}
        <details className="cz-section">
          <summary>Typography</summary>
          <label className="cz-linkall">
            Font for all classes
            <select
              value=""
              onChange={(e) =>
                e.target.value &&
                onChange({
                  ...overrides,
                  typeAll: { ...overrides.typeAll, font: e.target.value },
                })
              }
            >
              <option value="">— pick —</option>
              {FONTS.map((f) => (
                <option key={f.label} value={f.stack}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          {TYPE_CLASSES.map(({ kind, label }) => {
            const t = resolveType(preset, overrides, kind);
            return (
              <div className="cz-type" key={kind}>
                <div className="cz-type-head">{label}</div>
                <div className="cz-type-row">
                  <select
                    value={t.font}
                    onChange={(e) => setType(kind, { font: e.target.value })}
                  >
                    {FONTS.map((f) => (
                      <option key={f.label} value={f.stack}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="cz-type-row">
                  <input
                    type="color"
                    title="Text color"
                    value={toHex(t.color)}
                    onChange={(e) => setType(kind, { color: e.target.value })}
                  />
                  <input
                    type="color"
                    title="Halo color"
                    value={toHex(t.halo)}
                    onChange={(e) => setType(kind, { halo: e.target.value })}
                  />
                  <input
                    className="cz-range"
                    type="range"
                    title="Size"
                    min={0.6}
                    max={1.8}
                    step={0.05}
                    value={t.sizeScale}
                    onChange={(e) => setType(kind, { sizeScale: Number(e.target.value) })}
                  />
                  <label className="cz-caps" title="Small caps">
                    <input
                      type="checkbox"
                      checked={t.smallCaps}
                      onChange={(e) => setType(kind, { smallCaps: e.target.checked })}
                    />
                    SC
                  </label>
                </div>
              </div>
            );
          })}
        </details>

        <button
          type="button"
          className="btn cz-reset"
          disabled={!dirty}
          onClick={onReset}
        >
          Reset customizations
        </button>
      </div>
    </details>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="cz-paint">
      <span className="cz-paint-label">{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
