// Poster aspect presets (PRD.md §5.7). Base ratios are stored portrait
// (width ≤ height); the orientation toggle swaps them.

export type Orientation = "portrait" | "landscape";

export interface AspectPreset {
  id: string;
  label: string;
  base: [number, number];
}

export const ASPECTS: AspectPreset[] = [
  { id: "2:3", label: "2 : 3", base: [2, 3] },
  { id: "3:4", label: "3 : 4", base: [3, 4] },
  { id: "1:1", label: "1 : 1", base: [1, 1] },
  { id: "iso", label: "ISO A (1 : √2)", base: [1, Math.SQRT2] },
];

export const ASPECTS_BY_ID: Record<string, AspectPreset> = Object.fromEntries(
  ASPECTS.map((a) => [a.id, a]),
);

export function aspectRatio(base: [number, number], orientation: Orientation): number {
  const [a, b] = base;
  return orientation === "portrait" ? a / b : b / a;
}
