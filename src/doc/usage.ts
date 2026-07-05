// Commercial-use classification for the current poster (prj.md §8). The only
// sources that constrain use are the tile sources actually painting the visible
// map — Natural Earth (public domain) and NASA Blue Marble are freely sellable,
// so when no restricted tiles are active the poster is sellable.

import { TILE_SOURCES_BY_ID, type CommercialUse } from "../render/tileSources";

export interface UsageInfo {
  level: CommercialUse;
  label: string;
  detail: string;
  tone: "ok" | "warn" | "block";
}

const META: Record<CommercialUse, { label: string; tone: "ok" | "warn" | "block" }> = {
  sellable: { label: "Freely sellable", tone: "ok" },
  attribution: { label: "OK with attribution", tone: "warn" },
  personal: { label: "Personal use only", tone: "block" },
  unknown: { label: "Check source terms", tone: "warn" },
};

export function posterUsage(activeTileSourceId: string | null): UsageInfo {
  if (!activeTileSourceId) {
    return {
      level: "sellable",
      ...META.sellable,
      detail:
        "Natural Earth (public domain) and NASA Blue Marble are free to use, including commercial resale of prints.",
    };
  }
  const src = TILE_SOURCES_BY_ID[activeTileSourceId];
  const level = src?.commercial ?? "unknown";
  return {
    level,
    ...META[level],
    detail: src ? `${src.attribution} — ${src.usageNote}` : "Unknown tile source.",
  };
}
