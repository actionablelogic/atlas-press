// Ambient declarations for geo libraries that ship no TypeScript types.

declare module "versor" {
  type Quaternion = [number, number, number, number];
  type Euler = [number, number, number];
  type Cartesian = [number, number, number];

  interface Versor {
    (euler: Euler): Quaternion;
    /** Euler rotation angles [lambda, phi, gamma] from a quaternion. */
    rotation(q: Quaternion): Euler;
    /** Cartesian unit vector from [longitude, latitude] in degrees. */
    cartesian(spherical: [number, number]): Cartesian;
    /** Quaternion rotating cartesian v0 to v1. */
    delta(v0: Cartesian, v1: Cartesian, alpha?: number): Quaternion;
    /** Hamilton product of two quaternions. */
    multiply(a: Quaternion, b: Quaternion): Quaternion;
  }

  const versor: Versor;
  export default versor;
}

declare module "d3-geo-projection" {
  import type { GeoProjection } from "d3-geo";
  export function geoRobinson(): GeoProjection;
  export function geoWinkel3(): GeoProjection;
  export function geoMollweide(): GeoProjection;
  interface GeoCylindricalEqualAreaProjection extends GeoProjection {
    parallel(): number;
    parallel(p: number): this;
  }
  export function geoCylindricalEqualArea(): GeoCylindricalEqualAreaProjection;
}

// world-atlas TopoJSON assets, imported as JSON. Kept loose (the concrete
// Topology shape is narrowed at the call site in geo/data.ts).
declare module "world-atlas/*.json" {
  const topology: {
    type: "Topology";
    objects: Record<string, unknown>;
    arcs: unknown[];
    [key: string]: unknown;
  };
  export default topology;
}
