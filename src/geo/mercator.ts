// Web Mercator (EPSG:3857) tile math. XYZ tiles cover the world in
// 2^z × 2^z tiles; (lon,lat) maps to fractional tile coordinates.

export const MERCATOR_MAX_LAT = 85.0511287798;

/** Fractional tile coordinates [x, y] at zoom z for a lon/lat in degrees. */
export function lonLatToTile(lon: number, lat: number, z: number): [number, number] {
  const n = 2 ** z;
  const clampedLat = Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, lat));
  const latRad = (clampedLat * Math.PI) / 180;
  const x = ((lon + 180) / 360) * n;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return [x, y];
}

/** Meters per pixel at a given latitude and zoom (256px tiles). */
export function metersPerPixel(lat: number, z: number): number {
  const EARTH_CIRCUMFERENCE = 40075016.686;
  return (
    (EARTH_CIRCUMFERENCE * Math.cos((lat * Math.PI) / 180)) / (256 * 2 ** z)
  );
}
