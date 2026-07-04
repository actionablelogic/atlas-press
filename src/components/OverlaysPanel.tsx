import type { Overlay, OverlayType } from "../overlays/types";
import { FONTS } from "../styles/fonts";

export interface GeoOverlayConfig {
  graticuleLabels: boolean;
}

interface Props {
  overlays: Overlay[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (type: OverlayType) => void;
  onChange: (o: Overlay) => void;
  onDelete: (id: string) => void;
  geo: GeoOverlayConfig;
  onGeoChange: (g: GeoOverlayConfig) => void;
}

const ADD: Array<{ type: OverlayType; label: string }> = [
  { type: "compass", label: "Compass" },
  { type: "cartouche", label: "Cartouche" },
  { type: "text", label: "Text" },
  { type: "frame", label: "Frame" },
];

const LABELS: Record<OverlayType, string> = {
  compass: "Compass",
  cartouche: "Cartouche",
  text: "Text",
  frame: "Frame",
};

export function OverlaysPanel({
  overlays,
  selectedId,
  onSelect,
  onAdd,
  onChange,
  onDelete,
  geo,
  onGeoChange,
}: Props) {
  const selected = overlays.find((o) => o.id === selectedId) ?? null;
  const hasFrame = overlays.some((o) => o.type === "frame");

  return (
    <div className="picker overlays-panel">
      <h2 className="picker-title">Overlays</h2>

      <label className="cz-check ov-geo">
        <input
          type="checkbox"
          checked={geo.graticuleLabels}
          onChange={(e) => onGeoChange({ ...geo, graticuleLabels: e.target.checked })}
        />
        Graticule degree labels
      </label>

      <div className="ov-add">
        {ADD.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            className="btn ov-add-btn"
            disabled={type === "frame" && hasFrame}
            onClick={() => onAdd(type)}
          >
            + {label}
          </button>
        ))}
      </div>

      {overlays.length > 0 && (
        <ul className="ov-list">
          {overlays.map((o) => (
            <li
              key={o.id}
              className={`ov-list-item${o.id === selectedId ? " is-active" : ""}`}
              onClick={() => onSelect(o.id)}
            >
              <span>{LABELS[o.type]}</span>
              <button
                type="button"
                className="ov-del"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(o.id);
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && <OverlayEditor o={selected} onChange={onChange} />}
    </div>
  );
}

function OverlayEditor({
  o,
  onChange,
}: {
  o: Overlay;
  onChange: (o: Overlay) => void;
}) {
  if (o.type === "cartouche") {
    return (
      <div className="ov-edit">
        <input
          className="sat-input"
          value={o.title}
          placeholder="Title"
          onChange={(e) => onChange({ ...o, title: e.target.value })}
        />
        <input
          className="sat-input"
          value={o.subtitle}
          placeholder="Subtitle"
          onChange={(e) => onChange({ ...o, subtitle: e.target.value })}
        />
        <label className="cz-check">
          <input
            type="checkbox"
            checked={o.boxed}
            onChange={(e) => onChange({ ...o, boxed: e.target.checked })}
          />
          Boxed
        </label>
      </div>
    );
  }
  if (o.type === "text") {
    return (
      <div className="ov-edit">
        <input
          className="sat-input"
          value={o.text}
          placeholder="Text"
          onChange={(e) => onChange({ ...o, text: e.target.value })}
        />
        <div className="ov-edit-row">
          <select
            value={o.font}
            onChange={(e) => onChange({ ...o, font: e.target.value })}
          >
            {FONTS.map((f) => (
              <option key={f.label} value={f.stack}>
                {f.label}
              </option>
            ))}
          </select>
          <input
            type="color"
            value={o.color}
            onChange={(e) => onChange({ ...o, color: e.target.value })}
          />
        </div>
      </div>
    );
  }
  if (o.type === "compass") {
    return (
      <div className="ov-edit ov-edit-row">
        <select
          value={o.design}
          onChange={(e) =>
            onChange({ ...o, design: e.target.value as "star" | "simple" })
          }
        >
          <option value="star">Star rose</option>
          <option value="simple">Simple</option>
        </select>
      </div>
    );
  }
  // frame
  return (
    <div className="ov-edit ov-edit-row">
      <select
        value={o.pattern}
        onChange={(e) =>
          onChange({ ...o, pattern: e.target.value as "thin" | "double" | "woven" })
        }
      >
        <option value="thin">Thin</option>
        <option value="double">Double</option>
        <option value="woven">Woven</option>
      </select>
      <input
        type="color"
        value={o.color}
        onChange={(e) => onChange({ ...o, color: e.target.value })}
      />
    </div>
  );
}
