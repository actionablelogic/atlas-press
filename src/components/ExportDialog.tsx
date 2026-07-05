import { useMemo, useState } from "react";
import type { ProjectionId } from "../geo/projections";
import type { StyleDef } from "../styles/styles";
import type { Overlay } from "../overlays/types";
import type { ExportState, TileConfig } from "./MapCanvas";
import type { UsageInfo } from "../doc/usage";
import {
  computeDims,
  defaultDpi,
  DPI_OPTIONS,
  formatBytes,
  PRINT_SIZES,
  type Dpi,
} from "../export/sizes";
import { renderExport, type ExportFormat } from "../export/renderExport";
import { exportSvg, isVectorStyle } from "../export/svgExport";

interface Props {
  projectionId: ProjectionId;
  style: StyleDef;
  tileConfig: TileConfig;
  showGraticuleLabels: boolean;
  overlays: Overlay[];
  credit: string;
  usage: UsageInfo;
  getExportState: () => ExportState | null;
  onClose: () => void;
}

const JPEG_MAX_MP = 100;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function ExportDialog({
  projectionId,
  style,
  tileConfig,
  showGraticuleLabels,
  overlays,
  credit,
  usage,
  getExportState,
  onClose,
}: Props) {
  const [sizeId, setSizeId] = useState("a0");
  const [customEdge, setCustomEdge] = useState(36);
  const [customUnit, setCustomUnit] = useState<"in" | "cm">("in");
  const preset = PRINT_SIZES.find((s) => s.id === sizeId) ?? PRINT_SIZES[0];
  const longEdgeIn =
    preset.id === "custom"
      ? customUnit === "cm"
        ? customEdge / 2.54
        : customEdge
      : preset.longEdgeIn;

  const [dpi, setDpi] = useState<Dpi>(defaultDpi(longEdgeIn));
  const [format, setFormat] = useState<ExportFormat | "svg">("png");
  const [footerOn, setFooterOn] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);

  const st = getExportState();
  const dims = useMemo(
    () => (st ? computeDims(st.width, st.height, longEdgeIn, dpi) : null),
    [st, longEdgeIn, dpi],
  );

  const vector = isVectorStyle(style);
  const jpegTooBig = dims ? dims.megapixels > JPEG_MAX_MP : false;

  const run = async () => {
    const state = getExportState();
    if (!state || !dims) return;
    await document.fonts?.ready;
    const footer = footerOn ? `Made with Natural Earth — ${credit}` : null;

    if (format === "svg") {
      const svg = exportSvg({
        projectionId,
        view: state.view,
        style,
        showGraticuleLabels,
        overlays,
        footer,
        previewW: state.width,
        previewH: state.height,
        dims,
      });
      download(new Blob([svg], { type: "image/svg+xml" }), "atlas-poster.svg");
      onClose();
      return;
    }

    setProgress(0);
    try {
      const blob = await renderExport({
        projectionId,
        view: state.view,
        style,
        tileConfig,
        showGraticuleLabels,
        overlays,
        footer,
        previewW: state.width,
        previewH: state.height,
        dims,
        format,
        onProgress: setProgress,
      });
      download(blob, `atlas-poster.${format === "jpeg" ? "jpg" : "png"}`);
      onClose();
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Export poster</h2>

        <label className="fld">
          <span>Print size</span>
          <select value={sizeId} onChange={(e) => setSizeId(e.target.value)}>
            {PRINT_SIZES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        {preset.id === "custom" && (
          <label className="fld">
            <span>Long edge</span>
            <div className="fld-row">
              <input
                type="number"
                value={customEdge}
                min={1}
                onChange={(e) => setCustomEdge(Number(e.target.value))}
              />
              <select
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value as "in" | "cm")}
              >
                <option value="in">in</option>
                <option value="cm">cm</option>
              </select>
            </div>
          </label>
        )}

        <label className="fld">
          <span>Resolution</span>
          <div className="fld-row">
            {DPI_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                className={`chip${dpi === d ? " is-active" : ""}`}
                onClick={() => setDpi(d)}
              >
                {d} DPI
              </button>
            ))}
          </div>
        </label>

        <label className="fld">
          <span>Format</span>
          <div className="fld-row">
            {(["png", "jpeg", "svg"] as const).map((f) => {
              const disabled = f === "svg" ? !vector : f === "jpeg" ? jpegTooBig : false;
              return (
                <button
                  key={f}
                  type="button"
                  disabled={disabled}
                  className={`chip${format === f ? " is-active" : ""}`}
                  onClick={() => setFormat(f)}
                  title={
                    disabled
                      ? f === "svg"
                        ? "SVG is available for vector styles only"
                        : "JPEG unavailable at this size — use PNG"
                      : ""
                  }
                >
                  {f.toUpperCase()}
                </button>
              );
            })}
          </div>
        </label>

        <label className="cz-check">
          <input
            type="checkbox"
            checked={footerOn}
            onChange={(e) => setFooterOn(e.target.checked)}
          />
          Attribution footer
        </label>

        <div className="export-readout">
          {dims ? (
            <>
              {dims.width.toLocaleString()} × {dims.height.toLocaleString()} px
              {" · "}
              {dims.megapixels.toFixed(0)} MP
              {" · ~"}
              {formatBytes(format === "jpeg" ? dims.estJpeg : dims.estPng)}
              {format === "svg" && " (vector)"}
            </>
          ) : (
            "Preparing…"
          )}
          {dims && dims.megapixels > 120 && format === "png" && (
            <div className="export-note">
              Large export — streamed encode may take 30–60 s.
            </div>
          )}
        </div>

        <div className={`usage-block tone-${usage.tone}`}>
          <div className="usage-block-head">
            {usage.tone === "ok" ? "✓" : "⚠"} {usage.label}
          </div>
          <div className="usage-block-detail">{usage.detail}</div>
        </div>

        {progress != null && (
          <div className="progress">
            <div className="progress-bar" style={{ width: `${progress * 100}%` }} />
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose} disabled={progress != null}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={run}
            disabled={progress != null || !dims}
          >
            {progress != null ? `Rendering ${(progress * 100) | 0}%` : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}
