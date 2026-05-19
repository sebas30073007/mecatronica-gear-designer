import type { Point2D } from './polar';

/**
 * Parametric involute of a circle with base radius rb.
 *
 * At t = 0  → point is on the base circle at angle 0: (rb, 0)
 * As t → +∞ → curve unrolls counterclockwise (increasing Y).
 *
 * The radius of the involute point at parameter t:
 *   r(t) = rb * sqrt(1 + t²)
 *
 * All values in math coordinates (Y up).
 */
export function involutePoint(rb: number, t: number): Point2D {
  return {
    x: rb * (Math.cos(t) + t * Math.sin(t)),
    y: rb * (Math.sin(t) - t * Math.cos(t)),
  };
}

/** Find the involute parameter t such that the point lies on a circle of radius r (r ≥ rb). */
export function involuteParamForRadius(rb: number, r: number): number {
  if (r <= rb) return 0;
  return Math.sqrt((r / rb) ** 2 - 1);
}

/**
 * inv(α) = tan(α) − α
 * Used to compute the angular offset of the involute at the pitch circle.
 */
export function involuteFunc(alpha: number): number {
  return Math.tan(alpha) - alpha;
}

/**
 * Generates `steps + 1` evenly-spaced points along one involute flank,
 * from startR (clamped to rb if below) up to endR.
 * Points are in math coordinates, centered at origin.
 */
export function involuteFlankPoints(
  baseR: number,
  startR: number,
  endR: number,
  steps: number,
): Point2D[] {
  const tStart = involuteParamForRadius(baseR, Math.max(baseR, startR));
  const tEnd   = involuteParamForRadius(baseR, endR);
  const pts: Point2D[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = tStart + (tEnd - tStart) * (i / steps);
    pts.push(involutePoint(baseR, t));
  }
  return pts;
}
