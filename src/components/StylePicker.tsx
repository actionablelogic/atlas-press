import { STYLES, type StyleId } from "../styles/styles";

interface Props {
  value: StyleId;
  onChange: (id: StyleId) => void;
}

const GROUPS: Array<{ key: "vector" | "raster"; label: string }> = [
  { key: "vector", label: "Vector" },
  { key: "raster", label: "Raster · imagery / city-level" },
];

export function StylePicker({ value, onChange }: Props) {
  return (
    <div className="picker">
      <h2 className="picker-title">Style</h2>
      {GROUPS.map((g) => (
        <div key={g.key} className="style-group">
          <div className="cz-sub">{g.label}</div>
          <div className="picker-grid">
            {STYLES.filter((s) => s.group === g.key).map((s) => (
              <button
                key={s.id}
                type="button"
                className={`proj-card${s.id === value ? " is-active" : ""}`}
                onClick={() => onChange(s.id)}
                title={s.character}
              >
                <span className="proj-card-label">{s.label}</span>
                <span className="proj-card-character">{s.character}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
