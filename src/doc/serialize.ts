// MapDocument (de)serialization for URL-hash sharing + save/load (prj.md §5.8).
// No accounts, no server. The API key is intentionally NOT serialized.

import type { ProjectionId } from "../geo/projections";
import type { StyleId } from "../styles/styles";
import type { StyleOverrides } from "../styles/overrides";
import type { Overlay } from "../overlays/types";
import type { View } from "../geo/view";
import type { Orientation } from "../poster/aspects";

export interface PosterDoc {
  v: 1;
  projectionId: ProjectionId;
  styleId: StyleId;
  overrides: StyleOverrides;
  tileSourceId: string;
  overlays: Overlay[];
  graticuleLabels: boolean;
  referenceLines?: boolean;
  scaleBar?: boolean;
  aspectId: string;
  orientation: Orientation;
  regionId: string | null;
  view: View | null;
}

const HASH_KEY = "d=";

export function encodeDoc(doc: PosterDoc): string {
  return encodeURIComponent(JSON.stringify(doc));
}

export function decodeDoc(s: string): PosterDoc | null {
  try {
    const doc = JSON.parse(decodeURIComponent(s));
    if (doc && doc.v === 1 && doc.projectionId && doc.styleId) return doc as PosterDoc;
  } catch {
    /* ignore malformed */
  }
  return null;
}

export function writeHash(doc: PosterDoc): string {
  const url = `${location.origin}${location.pathname}#${HASH_KEY}${encodeDoc(doc)}`;
  history.replaceState(null, "", url);
  return url;
}

export function readHash(): PosterDoc | null {
  const h = location.hash.replace(/^#/, "");
  if (!h.startsWith(HASH_KEY)) return null;
  return decodeDoc(h.slice(HASH_KEY.length));
}
