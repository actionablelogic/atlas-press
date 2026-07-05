import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapCanvas,
  type MapCanvasHandle,
  type TileConfig,
} from "./components/MapCanvas";
import { ExportDialog } from "./components/ExportDialog";
import { ProjectionPicker } from "./components/ProjectionPicker";
import { StylePicker } from "./components/StylePicker";
import { CustomizePanel } from "./components/CustomizePanel";
import { CanvasPanel } from "./components/CanvasPanel";
import { SatelliteSettings } from "./components/SatelliteSettings";
import { OverlayLayer } from "./components/OverlayLayer";
import {
  OverlaysPanel,
  type GeoOverlayConfig,
} from "./components/OverlaysPanel";
import { SearchBox } from "./components/SearchBox";
import { createOverlay, type Overlay, type OverlayType } from "./overlays/types";
import { getProjectionDef, type ProjectionId } from "./geo/projections";
import { getStyleDef, type StyleId } from "./styles/styles";
import { TILE_SOURCES_BY_ID } from "./render/tileSources";
import {
  applyOverrides,
  EMPTY_OVERRIDES,
  type StyleOverrides,
} from "./styles/overrides";
import { getGazetteer, type GazetteerEntry } from "./geo/gazetteer";
import {
  ASPECTS_BY_ID,
  aspectRatio,
  type Orientation,
} from "./poster/aspects";
import { readHash, writeHash, type PosterDoc } from "./doc/serialize";
import { posterUsage } from "./doc/usage";
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
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [selectedOverlay, setSelectedOverlay] = useState<string | null>(null);
  const [geoOverlays, setGeoOverlays] = useState<GeoOverlayConfig>({
    graticuleLabels: false,
  });
  const [aspectId, setAspectId] = useState("2:3");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [selection, setSelection] = useState<Selection>({ entry: null, nonce: 0 });
  const [resetNonce, setResetNonce] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeTileSource, setActiveTileSource] = useState<string | null>(null);
  const usage = posterUsage(activeTileSource);
  const mapRef = useRef<MapCanvasHandle>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const preset = getStyleDef(styleId);
  const style = useMemo(() => applyOverrides(preset, overrides), [preset, overrides]);
  const aspect = aspectRatio(
    (ASPECTS_BY_ID[aspectId] ?? ASPECTS_BY_ID["2:3"]).base,
    orientation,
  );
  const hasOverrides = overrides !== EMPTY_OVERRIDES;

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const applyDoc = (doc: PosterDoc) => {
    setProjectionId(doc.projectionId);
    setStyleId(doc.styleId);
    setOverrides(doc.overrides ?? EMPTY_OVERRIDES);
    setTileConfig({ sourceId: doc.tileSourceId ?? "eox-s2cloudless" });
    setOverlays(doc.overlays ?? []);
    setGeoOverlays({ graticuleLabels: !!doc.graticuleLabels });
    setAspectId(doc.aspectId ?? "2:3");
    setOrientation(doc.orientation ?? "portrait");
    const entry = doc.regionId
      ? getGazetteer().find((e) => e.id === doc.regionId) ?? null
      : null;
    setSelection((s) => ({ entry, nonce: s.nonce + 1 }));
    if (doc.view) {
      const view = doc.view;
      setTimeout(() => mapRef.current?.setView(view), 150);
    }
  };

  // Load a shared document from the URL hash on first mount.
  useEffect(() => {
    const doc = readHash();
    if (doc) applyDoc(doc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentDoc = (): PosterDoc => ({
    v: 1,
    projectionId,
    styleId,
    overrides,
    tileSourceId: tileConfig.sourceId,
    overlays,
    graticuleLabels: geoOverlays.graticuleLabels,
    aspectId,
    orientation,
    regionId: selection.entry?.id ?? null,
    view: mapRef.current?.getExportState()?.view ?? null,
  });

  const share = async () => {
    const url = writeHash(currentDoc());
    try {
      await navigator.clipboard.writeText(url);
      flash("Share link copied to clipboard");
    } catch {
      flash("Link is in the address bar");
    }
  };

  const saveFile = () => {
    const blob = new Blob([JSON.stringify(currentDoc(), null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "atlas-poster.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  const loadFile = (file: File) => {
    file.text().then((t) => {
      try {
        const doc = JSON.parse(t) as PosterDoc;
        if (doc.v === 1) applyDoc(doc);
        else flash("Unrecognized file");
      } catch {
        flash("Could not read file");
      }
    });
  };

  const handleSelectStyle = (id: StyleId) => {
    if (id === styleId) return;
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
    const currentIsAzimuthal =
      getProjectionDef(projectionId).capability.rotates === "lambdaPhiGamma";
    if (entry.suggestProjection && !currentIsAzimuthal) {
      setProjectionId(entry.suggestProjection);
    }
    setSelection((s) => ({ entry, nonce: s.nonce + 1 }));
  };

  const handleClear = () =>
    setSelection((s) => ({ entry: null, nonce: s.nonce + 1 }));

  const addOverlay = (type: OverlayType) => {
    const o = createOverlay(type);
    setOverlays((list) => [...list, o]);
    setSelectedOverlay(o.id);
  };
  const changeOverlay = (o: Overlay) =>
    setOverlays((list) => list.map((x) => (x.id === o.id ? o : x)));
  const deleteOverlay = (id: string) => {
    setOverlays((list) => list.filter((x) => x.id !== id));
    setSelectedOverlay((s) => (s === id ? null : s));
  };

  const rasterLayer = style.layers.find((l) => l.type === "raster");
  const credit = rasterLayer?.basemap
    ? `${TILE_SOURCES_BY_ID[rasterLayer.basemap]?.attribution ?? ""} · Natural Earth`
    : styleId === "satellite"
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
          <span
            className={`usage-badge tone-${usage.tone}`}
            title={usage.detail}
          >
            {usage.tone === "ok" ? "✓" : "⚠"} {usage.label}
          </span>
          <button type="button" className="btn" onClick={() => setResetNonce((n) => n + 1)}>
            Reset view
          </button>
          <button type="button" className="btn" onClick={share} title="Copy a shareable link">
            Share
          </button>
          <button type="button" className="btn" onClick={saveFile} title="Save .json">
            Save
          </button>
          <button type="button" className="btn" onClick={() => fileInput.current?.click()} title="Load .json">
            Load
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setExportOpen(true)}
          >
            Export ⭳
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
          <CanvasPanel
            aspectId={aspectId}
            orientation={orientation}
            onAspect={setAspectId}
            onOrientation={setOrientation}
          />
          <CustomizePanel
            preset={preset}
            overrides={overrides}
            onChange={setOverrides}
            onReset={() => setOverrides(EMPTY_OVERRIDES)}
          />
          <OverlaysPanel
            overlays={overlays}
            selectedId={selectedOverlay}
            onSelect={setSelectedOverlay}
            onAdd={addOverlay}
            onChange={changeOverlay}
            onDelete={deleteOverlay}
            geo={geoOverlays}
            onGeoChange={setGeoOverlays}
          />
          <p className="hint">
            Drag to rotate · scroll to zoom · double-click to re-center (globe views)
          </p>
        </aside>

        <main className="stage">
          <MapCanvas
            ref={mapRef}
            projectionId={projectionId}
            style={style}
            tileConfig={tileConfig}
            showGraticuleLabels={geoOverlays.graticuleLabels}
            aspect={aspect}
            region={selection.entry}
            selectionNonce={selection.nonce}
            resetNonce={resetNonce}
            onBackgroundPointerDown={() => setSelectedOverlay(null)}
            onActiveTileSource={setActiveTileSource}
          >
            <OverlayLayer
              overlays={overlays}
              selectedId={selectedOverlay}
              onSelect={setSelectedOverlay}
              onChange={changeOverlay}
            />
          </MapCanvas>
          <span className="map-credit">{credit}</span>
        </main>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {exportOpen && (
        <ExportDialog
          projectionId={projectionId}
          style={style}
          tileConfig={tileConfig}
          showGraticuleLabels={geoOverlays.graticuleLabels}
          overlays={overlays}
          credit={credit}
          usage={usage}
          getExportState={() => mapRef.current?.getExportState() ?? null}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  );
}
