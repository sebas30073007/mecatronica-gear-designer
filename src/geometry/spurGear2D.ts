/**
 * Generates a complete involute spur gear outline in math coordinates (Y up, mm).
 * Tooth 0 is centered on the +X axis.
 * The outline is ready to be transformed with applyViewport() for SVG rendering.
 */

import { involuteFlankPoints, involuteFunc } from './involute';
import { rotatePoint, mirrorY, polarToCartesian } from './polar';
import type { Point2D } from './polar';

export interface SpurGearParams {
  teeth: number;
  moduleMm: number;
  pressureAngleDeg: number;
  backlashMm?: number;  // default 0 (no backlash for preview)
  quality?: number;     // involute steps per flank, default 8
}

export interface SpurGearGeometry {
  outline: Point2D[];
  pitchRadius: number;
  outerRadius: number;
  rootRadius: number;
  baseRadius: number;
}

/** Points along a circular arc at radius r from startAngle to endAngle (CCW, math coords). */
function arcPoints(r: number, startAngle: number, endAngle: number, steps: number): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const a = startAngle + t * (endAngle - startAngle);
    pts.push(polarToCartesian(r, a));
  }
  return pts;
}

export function generateSpurGearOutline(params: SpurGearParams): SpurGearGeometry {
  const { teeth: z, moduleMm: m, pressureAngleDeg, backlashMm = 0, quality = 8 } = params;

  const pa     = pressureAngleDeg * (Math.PI / 180);
  const pitchR = m * z / 2;
  const outerR = pitchR + m;           // addendum = 1 × module
  const rootR  = pitchR - 1.25 * m;   // dedendum  = 1.25 × module
  const baseR  = pitchR * Math.cos(pa);

  const pitchAngle = (2 * Math.PI) / z; // angular pitch between consecutive teeth

  // Tooth half-angle at pitch circle (arc = π·m/2 split over two flanks)
  const halfAngleAtPitch = (Math.PI * m / 2 - backlashMm) / (2 * pitchR);

  // Rotation offset that positions the canonical involute so the tooth is centered at 0.
  // At pitch circle the involute is at angle invPA from +X (unrotated).
  // After rotation by flankPhase, the right flank sits at -halfAngleAtPitch.
  const invPA      = involuteFunc(pa);
  const flankPhase = -(halfAngleAtPitch + invPA);

  // ── Canonical single tooth at angle 0 ──────────────────────────────────────
  // The involute starts at max(baseR, rootR).
  const startR    = Math.max(baseR, rootR);
  const rawFlank  = involuteFlankPoints(baseR, startR, outerR, quality);

  // Right (south) flank: involute rotated into final position
  const rightFlank = rawFlank.map((p) => rotatePoint(p, flankPhase));

  // Left (north) flank: mirror of right flank about X axis, reversed so it
  // runs from tip back down to root (continuing the path CCW).
  const leftFlank = [...rightFlank].reverse().map(mirrorY);

  // Angles at which the flanks meet the root circle (for arc generation)
  const rightRootAngle = Math.atan2(rightFlank[0]!.y, rightFlank[0]!.x);
  const leftRootAngle  = Math.atan2(
    leftFlank[leftFlank.length - 1]!.y,
    leftFlank[leftFlank.length - 1]!.x,
  );

  // ── Build complete gear outline ─────────────────────────────────────────────
  const allPts: Point2D[] = [];

  for (let i = 0; i < z; i++) {
    const θ = i * pitchAngle; // this tooth's center angle

    // Radial segment from root circle up to the start of the involute flank
    // (only needed when base circle is larger than root circle)
    if (baseR > rootR) {
      allPts.push(rotatePoint(polarToCartesian(rootR, rightRootAngle), θ));
    }

    // Right (south) involute flank: root/base → tip
    rightFlank.forEach((p) => allPts.push(rotatePoint(p, θ)));

    // Left (north) involute flank: tip → root/base
    leftFlank.forEach((p) => allPts.push(rotatePoint(p, θ)));

    // Radial segment back down to root circle
    if (baseR > rootR) {
      allPts.push(rotatePoint(polarToCartesian(rootR, leftRootAngle), θ));
    }

    // Root arc from this tooth's left-root to the next tooth's right-root
    const arcStart = θ + leftRootAngle;
    let   arcEnd   = (i + 1) * pitchAngle + rightRootAngle;
    if (arcEnd <= arcStart + 1e-9) arcEnd += 2 * Math.PI; // wrap if needed

    allPts.push(...arcPoints(rootR, arcStart, arcEnd, 3));
  }

  return { outline: allPts, pitchRadius: pitchR, outerRadius: outerR, rootRadius: rootR, baseRadius: baseR };
}
