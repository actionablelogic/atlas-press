import { useMemo, useState } from "react";
import { MapCanvas, type TileConfig } from "./components/MapCanvas";
import { ProjectionPicker } from "./components/ProjectionPicker";
import { StylePicker } from "./components/StylePicker";
import { CustomizePanel } from "./components/CustomizePanel";
import { SatelliteSettings } from "./components/SatelliteSettings";
import { SearchBox } from "./components/SearchBox";
import { getProjectionDef, type ProjectionId } from "./geo/projections";
import { getStyleDef, type StyleId } from "./styles/styles";
import { TILE_SOURCES_BY_ID } from "./render/tileSources";
import {
  applyOverrides,
  EMPTY_OVERRIDES,
  type StyleOverrides,
} from "./styles/overrides";
import type { GazetteerEntry } from "./geo/gazetteer";
import "./App.css";

interface Selection {
  entry: GazetteerEntry | null;
  nonce: number;
}

export default function App() {
  const [projectionId, setProjectionId] = useState<ProjectionId>("robinson");
  const [styleId, setStyleId] = useState<StyleId>("classicAtlas");
  const [overrides, setOverrides] = useState<StyleOverrides>(EMPTY_OVERRIDES);
  const [tileConfig, setTileConfig] = useState<TileConfig>({
    sourceId: "eox-s2cloudless",
  });
  const [selection, setSelection] = useState<Selection>({
    entry: null,
    nonce: 0,
  });
  const [resetNonce, setResetNonce] = useState(0);

  const preset = getStyleDef(styleId);
  const style = useMemo(
    () => applyOverrides(preset, overrides),
    [preset, overrides],
  );

  const hasOverrides = overrides !== EMPTY_OVERRIDES;

  const handleSelectStyle = (id: StyleId) => {
    if (id === styleId) return;
    // Picking a new preset resets customizations (confirm if any exist).
    if (
      hasOverrides &&
      !window.confirm("Switching style will reset your customizations. Continue?")
    ) {
      return;
    }
    setOverrides(EMPTY_OVERRIDES);
    setStyleId(id);
  };

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

  // Attribution shown over the map (and, later, next to Export).
  const credit =
    styleId === "satellite"
      ? `${TILE_SOURCES_BY_ID[tileConfig.sourceId]?.attribution ?? ""} · NASA Blue Marble (world) · Natural Earth`
      : styleId === "terrain"
        ? "Natural Earth II shaded relief · Natural Earth"
        : "Natural Earth";

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
          <StylePicker value={styleId} onChange={handleSelectStyle} />
          {styleId === "satellite" && (
            <SatelliteSettings config={tileConfig} onChange={setTileConfig} />
          )}
          <CustomizePanel
            preset={preset}
            overrides={overrides}
            onChange={setOverrides}
            onReset={() => setOverrides(EMPTY_OVERRIDES)}
          />
          <p className="hint">
            Drag to rotate · scroll to zoom · double-click to re-center
            (globe views)
          </p>
        </aside>

        <main className="stage">
          <MapCanvas
            projectionId={projectionId}
            style={style}
            tileConfig={tileConfig}
            region={selection.entry}
            selectionNonce={selection.nonce}
            resetNonce={resetNonce}
          />
          <span className="map-credit">{credit}</span>
        </main>
      </div>
    </div>
  );
}
