// Rasterize decor overlays onto a canvas for export (the on-screen editor uses
// DOM/SVG in OverlayLayer; this mirrors those visuals at export resolution).
// Poster-relative geometry → pixel coords via the export width/height.

import { isPositioned, type Overlay, type PositionedOverlay } from "../overlays/types";

export function drawOverlays(
  ctx: CanvasRenderingContext2D,
  overlays: Overlay[],
  width: number,
  height: number,
): void {
  // Frame is a full-canvas band, drawn first (behind stickers).
  for (const o of overlays) {
    if (o.type === "frame") drawFrame(ctx, o.pattern, o.color, width, height);
  }
  for (const o of overlays) {
    if (isPositioned(o)) drawSticker(ctx, o, width, height);
  }
}

function drawSticker(
  ctx: CanvasRenderingContext2D,
  o: PositionedOverlay,
  W: number,
  H: number,
): void {
  ctx.save();
  ctx.translate(o.x * W, o.y * H);
  ctx.rotate((o.rotation * Math.PI) / 180);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (o.type === "compass") {
    drawCompass(ctx, 0.16 * H * o.scale, o.design);
  } else if (o.type === "text") {
    ctx.font = `${o.sizeRel * H * o.scale}px ${o.font}`;
    ctx.fillStyle = o.color;
    ctx.fillText(o.text, 0, 0);
  } else {
    // cartouche
    const title = 0.045 * H * o.scale;
    const sub = title * 0.5;
    ctx.font = `700 ${title}px 'Playfair Display', Georgia, serif`;
    const tw = ctx.measureText(o.title).width;
    const sw = o.subtitle
      ? ((ctx.font = `italic ${sub}px 'EB Garamond', Georgia, serif`),
        ctx.measureText(o.subtitle).width)
      : 0;
    const boxW = Math.max(tw, sw) + title * 1.6;
    const boxH = title * (o.subtitle ? 2.1 : 1.4);
    if (o.boxed) {
      ctx.fillStyle = "rgba(246,242,232,0.85)";
      ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
      ctx.lineWidth = Math.max(1, title * 0.05);
      ctx.strokeStyle = "#7a6a4f";
      ctx.strokeRect(-boxW / 2 + 3, -boxH / 2 + 3, boxW - 6, boxH - 6);
    }
    ctx.fillStyle = "#2c2822";
    ctx.font = `700 ${title}px 'Playfair Display', Georgia, serif`;
    ctx.fillText(o.title, 0, o.subtitle ? -sub * 0.6 : 0);
    if (o.subtitle) {
      ctx.fillStyle = "#6b6152";
      ctx.font = `italic ${sub}px 'EB Garamond', Georgia, serif`;
      ctx.fillText(o.subtitle, 0, title * 0.7);
    }
  }
  ctx.restore();
}

function drawCompass(
  ctx: CanvasRenderingContext2D,
  size: number,
  design: "star" | "simple",
): void {
  const k = size / 100;
  ctx.save();
  ctx.scale(k, k);
  ctx.translate(-50, -50);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#7a6a4f";
  ctx.fillStyle = "none";
  for (const r of [46, 38]) {
    ctx.beginPath();
    ctx.arc(50, 50, r, 0, Math.PI * 2);
    ctx.lineWidth = r === 46 ? 1.5 : 0.8;
    ctx.stroke();
  }
  const dark = "#2c2822";
  const light = "#efe6d2";
  const tri = (pts: number[][], fill: string) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.lineTo(pts[1][0], pts[1][1]);
    ctx.lineTo(pts[2][0], pts[2][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = dark;
    ctx.stroke();
  };
  if (design === "star") {
    tri([[50, 6], [57, 50], [50, 50]], dark);
    tri([[50, 6], [43, 50], [50, 50]], light);
    tri([[94, 50], [50, 57], [50, 50]], light);
    tri([[94, 50], [50, 43], [50, 50]], dark);
    tri([[50, 94], [43, 50], [50, 50]], dark);
    tri([[50, 94], [57, 50], [50, 50]], light);
    tri([[6, 50], [50, 43], [50, 50]], light);
    tri([[6, 50], [50, 57], [50, 50]], dark);
  } else {
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark;
    ctx.beginPath();
    ctx.moveTo(50, 8);
    ctx.lineTo(50, 92);
    ctx.moveTo(8, 50);
    ctx.lineTo(92, 50);
    ctx.stroke();
  }
  ctx.fillStyle = dark;
  ctx.font = "700 13px 'EB Garamond', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", 50, 16);
  ctx.restore();
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  pattern: string,
  color: string,
  W: number,
  H: number,
): void {
  const inset = 0.012 * Math.min(W, H);
  const x = inset,
    y = inset,
    w = W - 2 * inset,
    h = H - 2 * inset;
  ctx.save();
  ctx.strokeStyle = color;
  if (pattern === "thin") {
    ctx.lineWidth = Math.max(1, 0.002 * Math.min(W, H));
    ctx.strokeRect(x, y, w, h);
  } else if (pattern === "double") {
    const lw = Math.max(1, 0.0016 * Math.min(W, H));
    const gap = lw * 3;
    ctx.lineWidth = lw;
    ctx.strokeRect(x, y, w, h);
    ctx.strokeRect(x + gap, y + gap, w - 2 * gap, h - 2 * gap);
  } else {
    // woven: thick double + inner rule
    const lw = Math.max(1, 0.0022 * Math.min(W, H));
    const gap = lw * 2.5;
    ctx.lineWidth = lw;
    ctx.strokeRect(x, y, w, h);
    ctx.strokeRect(x + gap, y + gap, w - 2 * gap, h - 2 * gap);
    ctx.strokeRect(x + gap * 2.4, y + gap * 2.4, w - 4.8 * gap, h - 4.8 * gap);
  }
  ctx.restore();
}
