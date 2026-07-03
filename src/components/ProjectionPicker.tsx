import { PROJECTIONS, type ProjectionId } from "../geo/projections";

interface Props {
  value: ProjectionId;
  onChange: (id: ProjectionId) => void;
}

export function ProjectionPicker({ value, onChange }: Props) {
  return (
    <div className="picker">
      <h2 className="picker-title">Projection</h2>
      <div className="picker-grid">
        {PROJECTIONS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`proj-card${p.id === value ? " is-active" : ""}`}
            onClick={() => onChange(p.id)}
            title={p.character}
          >
            <span className="proj-card-label">{p.label}</span>
            <span className="proj-card-character">{p.character}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
