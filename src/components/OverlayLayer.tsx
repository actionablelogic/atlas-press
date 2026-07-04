import { useRef } from "react";
import {
  isPositioned,
  type Overlay,
  type PositionedOverlay,
} from "../overlays/types";

interface Props {
  overlays: Overlay[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (o: Overlay) => void;
}

type Mode = "move" | "resize" | "rotate";

interface Drag {
  mode: Mode;
  id: string;
  px: number;
  py: number;
  startX: number;
  startY: number;
  startScale: number;
  startRot: number;
  w: number;
  h: number;
  cx: number; // center in client px
  cy: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const snap = (v: number) => (Math.abs(v - 0.5) < 0.015 ? 0.5 : v);

export function OverlayLayer({ overlays, selectedId, onSelect, onChange }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  const rect = () => rootRef.current!.getBoundingClientRect();

  const begin = (e: React.PointerEvent, o: PositionedOverlay, mode: Mode) => {
    e.stopPropagation();
    onSelect(o.id);
    const r = rect();
    drag.current = {
      mode,
      id: o.id,
      px: e.clientX,
      py: e.clientY,
      startX: o.x,
      startY: o.y,
      startScale: o.scale,
      startRot: o.rotation,
      w: r.width,
      h: r.height,
      cx: r.left + o.x * r.width,
      cy: r.top + o.y * r.height,
    };
    rootRef.current!.setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const o = overlays.find((x) => x.id === d.id);
    if (!o || !isPositioned(o)) return;
    if (d.mode === "move") {
      const nx = clamp(snap(d.startX + (e.clientX - d.px) / d.w), 0, 1);
      const ny = clamp(snap(d.startY + (e.clientY - d.py) / d.h), 0, 1);
      onChange({ ...o, x: nx, y: ny });
    } else if (d.mode === "resize") {
      const d0 = Math.hypot(d.px - d.cx, d.py - d.cy) || 1;
      const d1 = Math.hypot(e.clientX - d.cx, e.clientY - d.cy);
      onChange({ ...o, scale: clamp((d.startScale * d1) / d0, 0.3, 5) });
    } else {
      const a0 = Math.atan2(d.py - d.cy, d.px - d.cx);
      const a1 = Math.atan2(e.clientY - d.cy, e.clientX - d.cx);
      let deg = d.startRot + ((a1 - a0) * 180) / Math.PI;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      onChange({ ...o, rotation: deg });
    }
  };

  const end = () => {
    drag.current = null;
  };

  const r = rootRef.current?.getBoundingClientRect();
  const H = r?.height ?? 800;

  return (
    <div
      ref={rootRef}
      className="overlay-layer"
      onPointerMove={onMove}
      onPointerUp={end}
      onPointerDown={() => onSelect(null)}
    >
      {overlays.map((o) =>
        o.type === "frame" ? (
          <FrameView key={o.id} pattern={o.pattern} color={o.color} />
        ) : (
          <PositionedView
            key={o.id}
            o={o}
            posterH={H}
            selected={o.id === selectedId}
            onBody={(e) => begin(e, o, "move")}
            onResize={(e) => begin(e, o, "resize")}
            onRotate={(e) => begin(e, o, "rotate")}
          />
        ),
      )}
    </div>
  );
}

function PositionedView({
  o,
  posterH,
  selected,
  onBody,
  onResize,
  onRotate,
}: {
  o: PositionedOverlay;
  posterH: number;
  selected: boolean;
  onBody: (e: React.PointerEvent) => void;
  onResize: (e: React.PointerEvent) => void;
  onRotate: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      className={`ov-item${selected ? " is-selected" : ""}`}
      style={{
        left: `${o.x * 100}%`,
        top: `${o.y * 100}%`,
        transform: `translate(-50%, -50%) rotate(${o.rotation}deg)`,
      }}
      onPointerDown={onBody}
    >
      <OverlayContent o={o} posterH={posterH} />
      {selected && (
        <>
          <span className="ov-outline" />
          <span
            className="ov-handle ov-rot"
            onPointerDown={onRotate}
            title="Rotate (Shift = snap 15°)"
          />
          <span className="ov-handle ov-se" onPointerDown={onResize} title="Resize" />
        </>
      )}
    </div>
  );
}

function OverlayContent({ o, posterH }: { o: PositionedOverlay; posterH: number }) {
  if (o.type === "compass") {
    const size = 0.16 * posterH * o.scale;
    return <Compass size={size} design={o.design} />;
  }
  if (o.type === "text") {
    return (
      <div
        className="ov-text"
        style={{
          fontFamily: o.font,
          fontSize: `${o.sizeRel * posterH * o.scale}px`,
          color: o.color,
        }}
      >
        {o.text}
      </div>
    );
  }
  // cartouche
  const titleSize = 0.045 * posterH * o.scale;
  return (
    <div className={`ov-cartouche${o.boxed ? " is-boxed" : ""}`}>
      <div className="ov-cart-title" style={{ fontSize: `${titleSize}px` }}>
        {o.title}
      </div>
      {o.subtitle && (
        <div className="ov-cart-sub" style={{ fontSize: `${titleSize * 0.5}px` }}>
          {o.subtitle}
        </div>
      )}
    </div>
  );
}

function Compass({ size, design }: { size: number; design: "star" | "simple" }) {
  const c = 50;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="ov-compass">
      <circle cx={c} cy={c} r={46} className="cr-ring" />
      <circle cx={c} cy={c} r={38} className="cr-ring2" />
      {design === "star" ? (
        <>
          <polygon points="50,6 57,50 50,50" className="cr-fill" />
          <polygon points="50,6 43,50 50,50" className="cr-outline" />
          <polygon points="94,50 50,57 50,50" className="cr-outline" />
          <polygon points="94,50 50,43 50,50" className="cr-fill" />
          <polygon points="50,94 43,50 50,50" className="cr-fill" />
          <polygon points="50,94 57,50 50,50" className="cr-outline" />
          <polygon points="6,50 50,43 50,50" className="cr-outline" />
          <polygon points="6,50 50,57 50,50" className="cr-fill" />
        </>
      ) : (
        <>
          <line x1={50} y1={8} x2={50} y2={92} className="cr-line" />
          <line x1={8} y1={50} x2={92} y2={50} className="cr-line" />
        </>
      )}
      <text x={50} y={16} className="cr-n">
        N
      </text>
    </svg>
  );
}

function FrameView({ pattern, color }: { pattern: string; color: string }) {
  return (
    <div
      className={`ov-frame ov-frame-${pattern}`}
      style={{ borderColor: color, color }}
    />
  );
}
