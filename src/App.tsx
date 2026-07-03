import { useState } from "react";
import { MapCanvas } from "./components/MapCanvas";
import { ProjectionPicker } from "./components/ProjectionPicker";
import { StylePicker } from "./components/StylePicker";
import { SearchBox } from "./components/SearchBox";
import { getProjectionDef, type ProjectionId } from "./geo/projections";
import type { StyleId } from "./styles/styles";
import type { GazetteerEntry } from "./geo/gazetteer";
import "./App.css";

interface Selection {
  entry: GazetteerEntry | null;
  nonce: number;
}

export default function App() {
  const [projectionId, setProjectionId] = useState<ProjectionId>("robinson");
  const [styleId, setStyleId] = useState<StyleId>("classicAtlas");
  const [selection, setSelection] = useState<Selection>({
    entry: null,
    nonce: 0,
  });
  const [resetNonce, setResetNonce] = useState(0);

  const handleSelect = (entry: GazetteerEntry) => {
    // Polar regions render poorly on world pseudo-cylindricals → auto-suggest
    // the entry's azimuthal projection, unless we're already on an azimuthal.
    const currentIsAzimuthal =
      getProjectionDef(projectionId).capability.rotates === "lambdaPhiGamma";
    if (entry.suggestProjection && !currentIsAzimuthal) {
      setProjectionId(entry.suggestProjection);
    }
    setSelection((s) => ({ entry, nonce: s.nonce + 1 }));
  };

  const handleClear = () =>
    setSelection((s) => ({ entry: null, nonce: s.nonce + 1 }));

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Atlas Press</span>
        <SearchBox
          selected={selection.entry}
          onSelect={handleSelect}
          onClear={handleClear}
        />
        <div className="topbar-actions">
          <button
            type="button"
            className="btn"
            onClick={() => setResetNonce((n) => n + 1)}
          >
            Reset view
          </button>
        </div>
      </header>

      <div className="body">
        <aside className="sidebar">
          <ProjectionPicker value={projectionId} onChange={setProjectionId} />
          <StylePicker value={styleId} onChange={setStyleId} />
          <p className="hint">
            Drag to rotate · scroll to zoom · double-click to re-center
            (globe views)
          </p>
        </aside>

        <main className="stage">
          <MapCanvas
            projectionId={projectionId}
            styleId={styleId}
            region={selection.entry}
            selectionNonce={selection.nonce}
            resetNonce={resetNonce}
          />
        </main>
      </div>
    </div>
  );
}
