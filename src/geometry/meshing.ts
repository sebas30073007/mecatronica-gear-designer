/**
 * Deterministic gear meshing phase calculation for external spur gear pairs.
 *
 * Coordinate convention:
 *   All angles are in MATH coordinates (Y up, CCW positive, radians).
 *   When rendering with SVG rotate(), negate: svg_deg = -math_rad * (180/π)
 *   This is because toLocalSvgPath flips Y, mapping math angle θ → SVG angle -θ.
 *
 * Tooth convention (enforced in spurGear2D.ts):
 *   At rotation 0, tooth 0 is centered on +X (angle 0).
 *   Valley 0 (gap between tooth 0 and tooth 1) is at pitchAngle/2.
 *   Tooth k is at k * (2π/teeth).
 *   Valley k is at (k + 0.5) * (2π/teeth).
 */

export function normalizeAngle(angle: number): number {
  const TWO_PI = 2 * Math.PI;
  return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
}

export interface MeshPhaseParams {
  driverTeeth: number;
  drivenTeeth: number;
  /** Direction FROM driver center TO driven center, in math coords (Y up, CCW+). */
  meshAngleRad: number;
}

export interface MeshPhaseResult {
  /** Math-coord rotation of the driver so tooth 0 points toward the driven gear. */
  driverInitialRotationRad: number;
  /** Math-coord rotation of the driven so valley 0 points toward the driver gear. */
  drivenInitialRotationRad: number;
}

/**
 * Computes initial rotations for both gears (math coords) such that:
 *   - Driver:  tooth 0 points exactly toward the driven gear's center.
 *   - Driven:  valley 0 points exactly toward the driver gear's center.
 *
 * No Math.round, no snap-to-nearest. The phase is set deterministically from
 * meshAngleRad alone.
 *
 * Render with: svg_rotate_deg = -rotationRad * (180/π)
 */
export function calculateExternalGearInitialPhase(params: MeshPhaseParams): MeshPhaseResult {
  const { drivenTeeth, meshAngleRad } = params;
  const drivenPitch = (2 * Math.PI) / drivenTeeth;

  // Driver: tooth 0 is at angle 0 when rotation=0.
  // Rotate by meshAngleRad so tooth 0 points toward driven.
  const driverInitialRotationRad = normalizeAngle(meshAngleRad);

  // Driven: valley 0 is at drivenPitch/2 when rotation=0.
  // We need: drivenPitch/2 + drivenInitialRotation = meshAngleRad + π (back toward driver)
  // → drivenInitialRotation = meshAngleRad + π - drivenPitch/2
  const drivenInitialRotationRad = normalizeAngle(meshAngleRad + Math.PI - drivenPitch / 2);

  return { driverInitialRotationRad, drivenInitialRotationRad };
}

/**
 * Returns animated math-coord rotations for both gears given a driver delta.
 * External gears counter-rotate: driven goes opposite to driver.
 *
 * For driver to appear CW on screen, pass a NEGATIVE driverDeltaRad (decreasing
 * math angle = CW via the SVG Y-flip).
 */
export function getExternalGearAnimatedRotations(params: {
  driverInitialRotationRad: number;
  drivenInitialRotationRad: number;
  driverDeltaRad: number;
  driverTeeth: number;
  drivenTeeth: number;
}) {
  const { driverInitialRotationRad, drivenInitialRotationRad,
          driverDeltaRad, driverTeeth, drivenTeeth } = params;
  return {
    driverRotationRad: driverInitialRotationRad + driverDeltaRad,
    drivenRotationRad: drivenInitialRotationRad - driverDeltaRad * (driverTeeth / drivenTeeth),
  };
}
