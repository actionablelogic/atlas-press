// Print-size presets + export dimension math. Until M7 adds true poster-aspect
// presets, the export locks to the current preview's aspect ratio; the print
// size sets resolution by fitting the poster's LONGER edge to the print's longer
// edge at the chosen DPI (WYSIWYG — export = same view at higher resolution).

export interface PrintSize {
  id: string;
  label: string;
  /** Longer physical edge, in inches. */
  longEdgeIn: number;
}

export const PRINT_SIZES: PrintSize[] = [
  { id: "in24x36", label: '24 × 36 in', longEdgeIn: 36 },
  { id: "cm50x70", label: "50 × 70 cm", longEdgeIn: 70 / 2.54 },
  { id: "a1", label: "ISO A1", longEdgeIn: 841 / 25.4 },
  { id: "a0", label: "ISO A0", longEdgeIn: 1189 / 25.4 },
  { id: "a0x2", label: "2 × A0", longEdgeIn: 1682 / 25.4 },
  { id: "custom", label: "Custom", longEdgeIn: 36 },
];

export const DPI_OPTIONS = [150, 200, 300] as const;
export type Dpi = (typeof DPI_OPTIONS)[number];

export interface ExportDims {
  width: number;
  height: number;
  megapixels: number;
  /** Rough encoded size estimates in bytes. */
  estPng: number;
  estJpeg: number;
}

export function computeDims(
  previewW: number,
  previewH: number,
  longEdgeIn: number,
  dpi: number,
): ExportDims {
  const longPreview = Math.max(previewW, previewH) || 1;
  const longPx = Math.round(longEdgeIn * dpi);
  const k = longPx / longPreview;
  const width = Math.max(1, Math.round(previewW * k));
  const height = Math.max(1, Math.round(previewH * k));
  const px = width * height;
  return {
    width,
    height,
    megapixels: px / 1e6,
    estPng: px * 4 * 0.4, // ~compressed RGBA
    estJpeg: px * 0.28,
  };
}

/** Sensible default DPI: A0-and-larger default to 200 (per PRD.md §5.7). */
export function defaultDpi(longEdgeIn: number): Dpi {
  return longEdgeIn >= 1189 / 25.4 ? 200 : 300;
}

export function formatBytes(n: number): string {
  if (n > 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n > 1e6) return `${(n / 1e6).toFixed(0)} MB`;
  return `${(n / 1e3).toFixed(0)} KB`;
}
