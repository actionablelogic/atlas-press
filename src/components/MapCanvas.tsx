import { useEffect, useRef } from "react";
import versor from "versor";
import { getProjectionDef, type ProjectionId } from "../geo/projections";
import { getWorld, type DetailLevel } from "../geo/data";
import type { GazetteerEntry } from "../geo/gazetteer";
import { buildProjection, fitRegion, fitWorld, type View } from "../geo/view";
import { getStyleDef, type StyleId } from "../styles/styles";
import { renderMap } from "../render/renderMap";

interface Props {
  projectionId: ProjectionId;
  styleId: StyleId;
  /** Selected region to center + fit, or null for a world fit. */
  region: GazetteerEntry | null;
  /** Bumps each time a region is (re-)selected, to force a re-fit. */
  selectionNonce: number;
  /** Bumping this integer re-fits the current region/world to the viewport. */
  resetNonce: number;
}

// Geometrically-correct-ish degrees of longitude per pixel on the globe.
const DEG_PER_PX = 180 / Math.PI;

export function MapCanvas({
  projectionId,
  styleId,
  region,
  selectionNonce,
  resetNonce,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Mutable render state kept in refs so drag/zoom never trigger React renders.
  const viewRef = useRef<View | null>(null);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const detailRef = useRef<DetailLevel>("50m");
  const rafRef = useRef<number | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const projectionIdRef = useRef(projectionId);
  projectionIdRef.current = projectionId;
  const styleIdRef = useRef(styleId);
  styleIdRef.current = styleId;
  const regionRef = useRef(region);
  regionRef.current = region;
  // Labels are skipped while the user is actively dragging/zooming.
  const labelsRef = useRef(true);

  // --- drawing ---------------------------------------------------------
  const draw = () => {
    const canvas = canvasRef.current;
    const view = viewRef.current;
    if (!canvas || !view) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height, dpr } = sizeRef.current;
    const projectionId = projectionIdRef.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderMap(ctx, {
      projection: buildProjection(projectionId, view),
      world: getWorld(detailRef.current),
      style: getStyleDef(styleIdRef.current),
      capability: getProjectionDef(projectionId).capability,
      width,
      height,
      pixelRatio: dpr,
      showLabels: labelsRef.current,
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

  // Style change only needs a redraw (view unchanged).
  useEffect(() => {
    labelsRef.current = true;
    scheduleDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleId]);

  // Track container size (CSS px) + devicePixelRatio.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const apply = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      const prev = sizeRef.current;
      sizeRef.current = { width, height, dpr };
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      // First sizing → fit. Subsequent resizes keep the view but re-fit so the
      // sphere stays centered (M1: simplest correct behavior).
      if (!viewRef.current || prev.width !== width || prev.height !== height) {
        refit();
      } else {
        scheduleDraw();
      }
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(wrap);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("dblclick", onDblClick);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("dblclick", onDblClick);
    };
  }, []);

  return (
    <div ref={wrapRef} className="map-canvas-wrap">
      <canvas ref={canvasRef} className="map-canvas" />
    </div>
  );
}
