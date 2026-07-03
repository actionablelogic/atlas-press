import { STYLES, type StyleId } from "../styles/styles";

interface Props {
  value: StyleId;
  onChange: (id: StyleId) => void;
}

export function StylePicker({ value, onChange }: Props) {
  return (
    <div className="picker">
      <h2 className="picker-title">Style</h2>
      <div className="picker-grid">
        {STYLES.map((s) => (
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
  );
}
