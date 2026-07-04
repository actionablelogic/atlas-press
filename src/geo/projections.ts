import {
  geoEqualEarth,
  geoOrthographic,
  geoAzimuthalEquidistant,
  geoConicEqualArea,
  geoStereographic,
  type GeoProjection,
} from "d3-geo";
import {
  geoRobinson,
  geoWinkel3,
  geoMollweide,
  geoCylindricalEqualArea,
} from "d3-geo-projection";

export type ProjectionId =
  | "equalEarth"
  | "robinson"
  | "winkel3"
  | "mollweide"
  | "hoboDyer"
  | "orthographic"
  | "azimuthalEquidistant"
  | "albers"
  | "stereographic";

/**
 * Which rotation axes are meaningful for a projection.
 * - "lambda"      → only longitude (world pseudo-cylindricals: rotating in φ
 *                   looks wrong, so we pan vertically instead).
 * - "lambdaPhi"   → longitude + latitude (conics).
 * - "lambdaPhiGamma" → full spherical rotation (azimuthals / globe views).
 */
export type RotationFreedom = "lambda" | "lambdaPhi" | "lambdaPhiGamma";

export interface ProjectionCapability {
  /** Rotation axes the projection responds to naturally. */
  rotates: RotationFreedom;
  /** Conics can derive standard parallels from the region bbox (⅙ rule). */
  supportsStandardParallels: boolean;
  /**
   * The projection shows only part of the sphere at once (a visible cap) and
   * should clip geometry to a hemisphere-like boundary.
   */
  clipsToSphere: boolean;
  /** clipAngle in degrees to apply, when clipsToSphere is true. */
  clipAngle?: number;
}

export interface ProjectionDef {
  id: ProjectionId;
  label: string;
  /** Short blurb shown on the picker card. */
  character: string;
  /** Fresh, unconfigured d3 projection instance. */
  factory: () => GeoProjection;
  capability: ProjectionCapability;
}

const worldCyl: ProjectionCapability = {
  rotates: "lambda",
  supportsStandardParallels: false,
  clipsToSphere: false,
};

const azimuthal: ProjectionCapability = {
  rotates: "lambdaPhiGamma",
  supportsStandardParallels: false,
  clipsToSphere: false,
};

export const PROJECTIONS: ProjectionDef[] = [
  {
    id: "equalEarth",
    label: "Equal Earth",
    character: "Modern equal-area world map",
    factory: () => geoEqualEarth(),
    capability: worldCyl,
  },
  {
    id: "robinson",
    label: "Robinson",
    character: "The classic atlas look",
    factory: () => geoRobinson(),
    capability: worldCyl,
  },
  {
    id: "winkel3",
    label: "Winkel Tripel",
    character: "National Geographic's balanced choice",
    factory: () => geoWinkel3(),
    capability: worldCyl,
  },
  {
    id: "mollweide",
    label: "Mollweide",
    character: "Elliptical, equal-area, scientific",
    factory: () => geoMollweide(),
    capability: worldCyl,
  },
  {
    id: "hoboDyer",
    label: "Hobo–Dyer",
    character: "Rectangular equal-area, the anti-Mercator",
    // Lambert cylindrical equal-area with standard parallels at 37.5°.
    // Siblings (Gall–Peters 45°, Behrmann 30°, south-up γ=180°) are the same
    // one-parameter family — cheap variants for later.
    factory: () => geoCylindricalEqualArea().parallel(37.5),
    capability: worldCyl,
  },
  {
    id: "orthographic",
    label: "Orthographic",
    character: "The globe-from-space view",
    factory: () => geoOrthographic().clipAngle(90),
    capability: {
      rotates: "lambdaPhiGamma",
      supportsStandardParallels: false,
      clipsToSphere: true,
      clipAngle: 90,
    },
  },
  {
    id: "azimuthalEquidistant",
    label: "Azimuthal Equidistant",
    character: "Polar/radial UN-logo look",
    factory: () => geoAzimuthalEquidistant(),
    capability: azimuthal,
  },
  {
    id: "albers",
    label: "Albers Equal-Area Conic",
    character: "Curved parallels, the USGS look",
    factory: () => geoConicEqualArea().parallels([20, 50]),
    capability: {
      rotates: "lambdaPhi",
      supportsStandardParallels: true,
      clipsToSphere: false,
    },
  },
  {
    id: "stereographic",
    label: "Stereographic",
    character: "Conformal, dramatic edge stretch",
    factory: () => geoStereographic().clipAngle(150),
    capability: {
      rotates: "lambdaPhiGamma",
      supportsStandardParallels: false,
      clipsToSphere: true,
      clipAngle: 150,
    },
  },
];

export const PROJECTIONS_BY_ID: Record<ProjectionId, ProjectionDef> =
  Object.fromEntries(PROJECTIONS.map((p) => [p.id, p])) as Record<
    ProjectionId,
    ProjectionDef
  >;

export function getProjectionDef(id: ProjectionId): ProjectionDef {
  return PROJECTIONS_BY_ID[id];
}
