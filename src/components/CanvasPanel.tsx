import { ASPECTS, type Orientation } from "../poster/aspects";

interface Props {
  aspectId: string;
  orientation: Orientation;
  onAspect: (id: string) => void;
  onOrientation: (o: Orientation) => void;
}

export function CanvasPanel({ aspectId, orientation, onAspect, onOrientation }: Props) {
  return (
    <div className="picker canvas-panel">
      <h2 className="picker-title">Canvas</h2>
      <div className="picker-grid canvas-aspects">
        {ASPECTS.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`proj-card${a.id === aspectId ? " is-active" : ""}`}
            onClick={() => onAspect(a.id)}
          >
            <span className="proj-card-label">{a.label}</span>
          </button>
        ))}
      </div>
      <div className="fld-row canvas-orient">
        {(["portrait", "landscape"] as const).map((o) => (
          <button
            key={o}
            type="button"
            className={`chip${orientation === o ? " is-active" : ""}`}
            onClick={() => onOrientation(o)}
          >
            {o[0].toUpperCase() + o.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
