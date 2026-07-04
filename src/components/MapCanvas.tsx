import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ReactNode,
} from "react";
import versor from "versor";
import { getProjectionDef, type ProjectionId } from "../geo/projections";
import { getWorld, type DetailLevel } from "../geo/data";
import type { GazetteerEntry } from "../geo/gazetteer";
import { buildProjection, fitRegion, fitWorld, type View } from "../geo/view";
import type { StyleDef } from "../styles/styles";
import { renderMap, type RenderRaster } from "../render/renderMap";
import { RasterWarper, equirectUv } from "../render/RasterWarper";
import { MercatorMosaic, visibleBbox } from "../render/MercatorMosaic";
import { TILE_SOURCES_BY_ID } from "../render/tileSources";
import { ensureRoads } from "../data/roads";
import { BUNDLED_FAMILIES } from "../styles/fonts";

export interface TileConfig {
  sourceId: string;
  apiKey?: string;
  customTemplate?: string;
}

export interface ExportState {
  view: View;
  width: number;
  height: number;
}

export interface MapCanvasHandle {
  getExportState: () => ExportState | null;
  /** Restore an exact camera (for URL/file document loading). */
  setView: (view: View) => void;
}

interface Props {
  projectionId: ProjectionId;
  /** Resolved style (preset + user overrides applied). */
  style: StyleDef;
  /** Region-scale satellite tile source config. */
  tileConfig: TileConfig;
  /** Draw graticule degree labels along the frame edge. */
  showGraticuleLabels: boolean;
  /** Poster aspect ratio (width / height). */
  aspect: number;
  /** Selected region to center + fit, or null for a world fit. */
  region: GazetteerEntry | null;
  /** Bumps each time a region is (re-)selected, to force a re-fit. */
  selectionNonce: number;
  /** Bumping this integer re-fits the current region/world to the viewport. */
  resetNonce: number;
  /** Fired on map pointer-down (used to deselect decor overlays). */
  onBackgroundPointerDown?: () => void;
  /** Decor overlay layer, rendered aligned over the canvas. */
  children?: ReactNode;
}

// Blue Marble equirect is ~5400px wide; below this many BM px across the view we
// switch to Mercator tiles (BM would be upscaled/blurry).
const BM_TEXTURE_WIDTH = 5400;

// Geometrically-correct-ish degrees of longitude per pixel on the globe.
const DEG_PER_PX = 180 / Math.PI;

export const MapCanvas = forwardRef<MapCanvasHandle, Props>(function MapCanvas(
  {
    projectionId,
    style,
    tileConfig,
    showGraticuleLabels,
    aspect,
    region,
    selectionNonce,
    resetNonce,
    onBackgroundPointerDown,
    children,
  },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Mutable render state kept in refs so drag/zoom never trigger React renders.
  const viewRef = useRef<View | null>(null);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const detailRef = useRef<DetailLevel>("50m");
  const rafRef = useRef<number | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const warperRef = useRef<RasterWarper | null>(null);
  const mosaicRef = useRef<MercatorMosaic | null>(null);
  const projectionIdRef = useRef(projectionId);
  projectionIdRef.current = projectionId;
  const styleRef = useRef(style);
  styleRef.current = style;
  const tileConfigRef = useRef(tileConfig);
  tileConfigRef.current = tileConfig;
  const gratLabelsRef = useRef(showGraticuleLabels);
  gratLabelsRef.current = showGraticuleLabels;
  const aspectRef = useRef(aspect);
  aspectRef.current = aspect;
  const bgPointerRef = useRef(onBackgroundPointerDown);
  bgPointerRef.current = onBackgroundPointerDown;
  const regionRef = useRef(region);
  regionRef.current = region;
  // Labels are skipped while the user is actively dragging/zooming.
  const labelsRef = useRef(true);

  useImperativeHandle(ref, () => ({
    getExportState: () => {
      const view = viewRef.current;
      const { width, height } = sizeRef.current;
      return view && width && height ? { view, width, height } : null;
    },
    setView: (view: View) => {
      viewRef.current = view;
      detailRef.current = "50m";
      labelsRef.current = true;
      scheduleDraw();
    },
  }));

  // Two-tier raster warping: terrain / world-satellite use the equirect Blue
  // Marble; at region scale, satellite switches to warped Mercator tiles drawn
  // on top of the Blue Marble base (which fills the mosaic's gaps).
  const renderRaster: RenderRaster = (layer, projection, width, height, gridCols) => {
    const warper = warperRef.current;
    const mosaic = mosaicRef.current;
    if (!warper?.supported || !layer.texture) return null;

    if (layer.texture === "terrain") {
      const tex = warper.ensureEquirect("terrain");
      if (!tex) return null;
      warper.drawMesh(projection, width, height, gridCols, tex, equirectUv, {
        wrap: true,
        clear: true,
      });
      return warper.canvas;
    }

    // satellite
    const bm = warper.ensureEquirect("satellite");
    const bbox = visibleBbox(projection, width, height);
    const useTiles =
      !!mosaic &&
      !!bbox &&
      ((bbox.maxLon - bbox.minLon) / 360) * BM_TEXTURE_WIDTH < width * 0.9;

    if (!useTiles) {
      if (!bm) return null;
      warper.drawMesh(projection, width, height, gridCols, bm, equirectUv, {
        wrap: true,
        clear: true,
      });
      return warper.canvas;
    }

    // Region scale. Refresh tiles only when idle (not mid-drag) to avoid thrash.
    const source = TILE_SOURCES_BY_ID[tileConfigRef.current.sourceId];
    if (labelsRef.current && source) {
      mosaic!.update(projection, width, height, {
        source,
        apiKey: tileConfigRef.current.apiKey,
        customTemplate: tileConfigRef.current.customTemplate,
      });
    }
    let drewBase = false;
    if (bm) {
      warper.drawMesh(projection, width, height, gridCols, bm, equirectUv, {
        wrap: true,
        clear: true,
      });
      drewBase = true;
    }
    const mtex = mosaic!.texture;
    if (mtex) {
      warper.drawMesh(projection, width, height, gridCols, mtex, mosaic!.uvFn, {
        wrap: false,
        clear: !drewBase,
      });
    }
    return drewBase || mtex ? warper.canvas : null;
  };

  // --- drawing ---------------------------------------------------------
  const draw = () => {
    const canvas = canvasRef.current;
    const view = viewRef.current;
    if (!canvas || !view) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height, dpr } = sizeRef.current;
    const projectionId = projectionIdRef.current;
    const style = styleRef.current;

    // Roads are lazy-loaded the first time a style includes the (visible) layer.
    if (style.layers.some((l) => l.type === "roads")) ensureRoads(scheduleDraw);

    warperRef.current?.setSize(width, height, dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderMap(ctx, {
      projection: buildProjection(projectionId, view),
      world: getWorld(detailRef.current),
      style,
      capability: getProjectionDef(projectionId).capability,
      width,
      height,
      pixelRatio: dpr,
      showLabels: labelsRef.current,
      showGraticuleLabels: gratLabelsRef.current,
      renderRaster,
    });
  };

  const scheduleDraw = () => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      draw();
    });
  };

  // Draw at reduced detail now, then upgrade to full detail once interaction
  // settles (the raster-warping milestones will lean on this hook heavily).
  const drawInteractive = () => {
    detailRef.current = "110m";
    labelsRef.current = false;
    scheduleDraw();
    if (idleTimerRef.current != null) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      detailRef.current = "50m";
      labelsRef.current = true;
      scheduleDraw();
    }, 160);
  };

  // --- fit on size / projection / region / reset -----------------------
  // Reads only refs, so the copy captured by the resize effect stays correct.
  const refit = () => {
    const { width, height } = sizeRef.current;
    if (width === 0 || height === 0) return;
    const proj = projectionIdRef.current;
    const r = regionRef.current;
    viewRef.current = r
      ? fitRegion(proj, r, width, height)
      : fitWorld(proj, width, height);
    detailRef.current = "50m";
    labelsRef.current = true;
    scheduleDraw();
  };

  useEffect(() => {
    refit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectionId, region, selectionNonce, resetNonce]);

  // Style / tile-source / overlay-toggle change only needs a redraw.
  useEffect(() => {
    labelsRef.current = true;
    scheduleDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, tileConfig, showGraticuleLabels]);

  // Force-load bundled fonts, then redraw so canvas text uses them (canvas
  // won't lazy-trigger a webfont fetch on its own).
  useEffect(() => {
    if (!document.fonts) return;
    Promise.all(
      BUNDLED_FAMILIES.map((f) => document.fonts.load(`16px '${f}'`)),
    ).then(() => scheduleDraw());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // WebGL raster warper + Mercator mosaic. Redraw when a texture or tile mosaic
  // becomes ready.
  useEffect(() => {
    const warper = new RasterWarper();
    warper.onTextureLoad = () => scheduleDraw();
    const mosaic = new MercatorMosaic(warper);
    mosaic.onReady = () => scheduleDraw();
    warperRef.current = warper;
    mosaicRef.current = mosaic;
    scheduleDraw();
    return () => {
      mosaic.dispose();
      warper.dispose();
      warperRef.current = null;
      mosaicRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Size the poster to a fixed-aspect box that contain-fits the stage, then size
  // the canvas to it. Re-runs when the stage resizes or the aspect changes.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const stage = wrap?.parentElement;
    if (!wrap || !canvas || !stage) return;
    const PAD = 28;

    const apply = () => {
      const availW = Math.max(1, stage.clientWidth - 2 * PAD);
      const availH = Math.max(1, stage.clientHeight - 2 * PAD);
      const ar = aspectRef.current;
      let width = availW;
      let height = width / ar;
      if (height > availH) {
        height = availH;
        width = height * ar;
      }
      width = Math.floor(width);
      height = Math.floor(height);
      wrap.style.width = `${width}px`;
      wrap.style.height = `${height}px`;

      const dpr = window.devicePixelRatio || 1;
      const prev = sizeRef.current;
      sizeRef.current = { width, height, dpr };
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      if (!viewRef.current || prev.width !== width || prev.height !== height) {
        refit();
      } else {
        scheduleDraw();
      }
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(stage);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect]);

  // --- pointer interaction ---------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let dragging = false;
    // Versor drag state (azimuthal projections).
    let v0: [number, number, number] | null = null;
    let q0: [number, number, number, number] | null = null;
    let r0: [number, number, number] = [0, 0, 0];
    // Pixel-delta drag state (world/conic projections).
    let last: [number, number] = [0, 0];

    const pointer = (e: PointerEvent): [number, number] => {
      const rect = canvas.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    };

    const onPointerDown = (e: PointerEvent) => {
      const view = viewRef.current;
      if (!view) return;
      bgPointerRef.current?.(); // deselect decor overlays when grabbing the map
      dragging = true;
      canvas.setPointerCapture(e.pointerId);
      const cap = getProjectionDef(projectionIdRef.current).capability;
      const pt = pointer(e);
      if (cap.rotates === "lambdaPhiGamma") {
        const proj = buildProjection(projectionIdRef.current, view);
        const inv = proj.invert?.(pt);
        r0 = view.rotation;
        q0 = versor(r0);
        v0 = inv ? versor.cartesian(inv as [number, number]) : null;
      } else {
        last = pt;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const view = viewRef.current;
      if (!view) return;
      const cap = getProjectionDef(projectionIdRef.current).capability;
      const pt = pointer(e);

      if (cap.rotates === "lambdaPhiGamma") {
        if (!v0 || !q0) return;
        const proj = buildProjection(projectionIdRef.current, {
          ...view,
          rotation: r0,
        });
        const inv = proj.invert?.(pt);
        if (!inv) return;
        const v1 = versor.cartesian(inv as [number, number]);
        const q1 = versor.multiply(q0, versor.delta(v0, v1));
        view.rotation = versor.rotation(q1);
      } else {
        // Horizontal drag spins longitude; vertical drag pans the poster.
        const dx = pt[0] - last[0];
        const dy = pt[1] - last[1];
        last = pt;
        const k = DEG_PER_PX / view.scale;
        view.rotation = [
          view.rotation[0] + dx * k,
          view.rotation[1],
          view.rotation[2],
        ];
        view.translate = [view.translate[0], view.translate[1] + dy];
      }
      drawInteractive();
    };

    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      v0 = null;
      q0 = null;
      if (canvas.hasPointerCapture(e.pointerId))
        canvas.releasePointerCapture(e.pointerId);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const view = viewRef.current;
      if (!view) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0012);
      // Keep the point under the cursor fixed while scaling.
      view.translate = [
        mx - (mx - view.translate[0]) * factor,
        my - (my - view.translate[1]) * factor,
      ];
      view.scale = Math.max(1, view.scale * factor);
      drawInteractive();
    };

    const onDblClick = (e: MouseEvent) => {
      const view = viewRef.current;
      if (!view) return;
      const cap = getProjectionDef(projectionIdRef.current).capability;
      if (cap.rotates !== "lambdaPhiGamma") return;
      const rect = canvas.getBoundingClientRect();
      const proj = buildProjection(projectionIdRef.current, view);
      const inv = proj.invert?.([e.clientX - rect.left, e.clientY - rect.top]);
      if (!inv) return;
      view.rotation = [-inv[0], -inv[1], view.rotation[2]];
      drawInteractive();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const view = viewRef.current;
      if (!view) return;
      const cap = getProjectionDef(projectionIdRef.current).capability;
      const { width, height } = sizeRef.current;
      const step = 6;
      const zoom = (f: number) => {
        const cx = width / 2;
        const cy = height / 2;
        view.translate = [
          cx - (cx - view.translate[0]) * f,
          cy - (cy - view.translate[1]) * f,
        ];
        view.scale = Math.max(1, view.scale * f);
      };
      let handled = true;
      switch (e.key) {
        case "ArrowLeft":
          view.rotation = [view.rotation[0] - step, view.rotation[1], view.rotation[2]];
          break;
        case "ArrowRight":
          view.rotation = [view.rotation[0] + step, view.rotation[1], view.rotation[2]];
          break;
        case "ArrowUp":
          if (cap.rotates === "lambdaPhiGamma")
            view.rotation = [view.rotation[0], Math.min(90, view.rotation[1] + step), view.rotation[2]];
          else view.translate = [view.translate[0], view.translate[1] + 24];
          break;
        case "ArrowDown":
          if (cap.rotates === "lambdaPhiGamma")
            view.rotation = [view.rotation[0], Math.max(-90, view.rotation[1] - step), view.rotation[2]];
          else view.translate = [view.translate[0], view.translate[1] - 24];
          break;
        case "+":
        case "=":
          zoom(1.15);
          break;
        case "-":
        case "_":
          zoom(1 / 1.15);
          break;
        default:
          handled = false;
      }
      if (handled) {
        e.preventDefault();
        drawInteractive();
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("dblclick", onDblClick);
    canvas.addEventListener("keydown", onKeyDown);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("dblclick", onDblClick);
      canvas.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div ref={wrapRef} className="map-canvas-wrap">
      <canvas
        ref={canvasRef}
        className="map-canvas"
        tabIndex={0}
        role="application"
        aria-label="Map preview — arrow keys to pan, plus/minus to zoom"
      />
      {children}
    </div>
  );
});
