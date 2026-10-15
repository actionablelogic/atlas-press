// Licence notice for the current poster (PRD.md §8). The only sources that
// constrain use are the tile sources actually painting the visible map —
// Natural Earth (public domain) and NASA Blue Marble carry no restrictions, so
// when no tile source is active the poster is open.

import { TILE_SOURCES_BY_ID, type UsageTerms } from "../render/tileSources";

export interface UsageInfo {
  level: UsageTerms;
  label: string;
  detail: string;
  tone: "ok" | "warn" | "block";
}

const META: Record<UsageTerms, { label: string; tone: "ok" | "warn" | "block" }> = {
  open: { label: "Public domain data", tone: "ok" },
  attribution: { label: "Attribution required", tone: "warn" },
  "non-commercial": { label: "Non-commercial licence", tone: "block" },
  unknown: { label: "Check source terms", tone: "warn" },
};

export function posterUsage(activeTileSourceId: string | null): UsageInfo {
  if (!activeTileSourceId) {
    return {
      level: "open",
      ...META.open,
      detail:
        "Natural Earth (public domain) and NASA Blue Marble imagery. No usage restrictions; credit appreciated.",
    };
  }
  const src = TILE_SOURCES_BY_ID[activeTileSourceId];
  const level = src?.terms ?? "unknown";
  return {
    level,
    ...META[level],
    detail: src ? `${src.attribution} — ${src.usageNote}` : "Unknown tile source.",
  };
}
