import {
  geoBounds,
  type GeoConicProjection,
  type GeoProjection,
} from "d3-geo";
import { getProjectionDef, type ProjectionId } from "./projections";
import type { GazetteerEntry } from "./gazetteer";

/** Camera state for a rendered map. Kept in refs on the canvas (see MapCanvas). */
export interface View {
  rotation: [number, number, number];
  scale: number;
  translate: [number, number];
}

const FIT_PADDING = 24; // px, world fit
const FIT_INSET = 0.15; // region fills the middle ~70% of the canvas

export function buildProjection(
  projectionId: ProjectionId,
  view: View,
): GeoProjection {
  return getProjectionDef(projectionId)
    .factory()
    .rotate(view.rotation)
    .scale(view.scale)
    .translate(view.translate);
}

/** Fit the whole sphere into the viewport (default / no region selected). */
export function fitWorld(
  projectionId: ProjectionId,
  width: number,
  height: number,
): View {
  const p = getProjectionDef(projectionId).factory().rotate([0, 0, 0]);
  p.fitExtent(
    [
      [FIT_PADDING, FIT_PADDING],
      [width - FIT_PADDING, height - FIT_PADDING],
    ],
    { type: "Sphere" },
  );
  return readView(p);
}

/**
 * Center + fit a gazetteer region. Rotation strategy depends on the
 * projection's capability (PRD.md §5.1 / §5.3):
 *  - azimuthals rotate freely to put the centroid at the projection center,
 *  - conics rotate λ, center φ, and derive standard parallels via the ⅙ rule,
 *  - world pseudo-cylindricals only rotate λ (rotating φ looks wrong).
 * Fitting is done against the region's geometry, so antimeridian-spanning
 * regions frame correctly once their centroid is rotated to center.
 */
export function fitRegion(
  projectionId: ProjectionId,
  entry: GazetteerEntry,
  width: number,
  height: number,
): View {
  const def = getProjectionDef(projectionId);
  const p = def.factory();
  const [lon, lat] = entry.centroid;
  const cap = def.capability;

  if (cap.rotates === "lambdaPhiGamma") {
    p.rotate([-lon, -lat, 0]);
  } else if (cap.supportsStandardParallels) {
    const [[, south], [, north]] = geoBounds(entry.fitFeature);
    const [p1, p2] =
      north > south
        ? [south + (north - south) / 6, north - (north - south) / 6]
        : [lat - 10, lat + 10];
    (p as GeoConicProjection).parallels([p1, p2]);
    p.rotate([-lon, 0, 0]);
    p.center([0, lat]);
  } else {
    p.rotate([-lon, 0, 0]);
  }

  p.fitExtent(
    [
      [width * FIT_INSET, height * FIT_INSET],
      [width * (1 - FIT_INSET), height * (1 - FIT_INSET)],
    ],
    entry.fitFeature,
  );

  const scale = p.scale();
  if (!Number.isFinite(scale) || scale <= 0) {
    // Degenerate fit (e.g. region entirely clipped) → fall back to world.
    return fitWorld(projectionId, width, height);
  }
  return readView(p);
}

function readView(p: GeoProjection): View {
  return {
    rotation: p.rotate() as [number, number, number],
    scale: p.scale(),
    translate: p.translate() as [number, number],
  };
}
