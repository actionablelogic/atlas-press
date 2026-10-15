// Poster overlays. Two families (PRD.md §5.6):
//  - Geographic overlays (graticule edge labels) reproject with the map and are
//    drawn on the canvas — see render/graticuleLabels.ts.
//  - Decor overlays ("stickers") are locked to the poster canvas and are freely
//    draggable/resizable/rotatable. Positions are poster-relative (0..1) so they
//    survive resize and export at any resolution.

export type OverlayType = "compass" | "cartouche" | "text" | "frame";

interface Transform {
  /** Center position, poster-relative (0..1). */
  x: number;
  y: number;
  /** Size multiplier (1 = default). */
  scale: number;
  /** Degrees clockwise. */
  rotation: number;
}

export interface CompassOverlay extends Transform {
  id: string;
  type: "compass";
  design: "star" | "simple";
}

export interface CartoucheOverlay extends Transform {
  id: string;
  type: "cartouche";
  title: string;
  subtitle: string;
  boxed: boolean;
}

export interface TextOverlay extends Transform {
  id: string;
  type: "text";
  text: string;
  color: string;
  font: string;
  /** Base font size, poster-relative (fraction of poster height). */
  sizeRel: number;
}

/** The frame is a full-canvas edge band, not a movable sprite. */
export interface FrameOverlay {
  id: string;
  type: "frame";
  pattern: "thin" | "double" | "woven";
  color: string;
}

export type Overlay =
  | CompassOverlay
  | CartoucheOverlay
  | TextOverlay
  | FrameOverlay;

export type PositionedOverlay = CompassOverlay | CartoucheOverlay | TextOverlay;

export function isPositioned(o: Overlay): o is PositionedOverlay {
  return o.type !== "frame";
}

let seq = 0;
const nid = (t: string) => `${t}-${Date.now().toString(36)}-${seq++}`;

export function createOverlay(type: OverlayType): Overlay {
  switch (type) {
    case "compass":
      return { id: nid("compass"), type, x: 0.85, y: 0.82, scale: 1, rotation: 0, design: "star" };
    case "cartouche":
      return {
        id: nid("cartouche"),
        type,
        x: 0.5,
        y: 0.12,
        scale: 1,
        rotation: 0,
        title: "The World",
        subtitle: "Classic Edition",
        boxed: true,
      };
    case "text":
      return {
        id: nid("text"),
        type,
        x: 0.5,
        y: 0.9,
        scale: 1,
        rotation: 0,
        text: "Double-click to edit",
        color: "#2c2822",
        font: "'EB Garamond', Georgia, serif",
        sizeRel: 0.03,
      };
    case "frame":
      return { id: nid("frame"), type, pattern: "double", color: "#7a6a4f" };
  }
}
