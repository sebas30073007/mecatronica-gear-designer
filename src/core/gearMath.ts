const DEG_TO_RAD = Math.PI / 180;

export function pitchDiameter(moduleMm: number, teeth: number): number {
  return moduleMm * teeth;
}

export function pitchRadius(moduleMm: number, teeth: number): number {
  return pitchDiameter(moduleMm, teeth) / 2;
}

export function outerDiameter(moduleMm: number, teeth: number): number {
  return moduleMm * (teeth + 2);
}

export function rootDiameter(moduleMm: number, teeth: number): number {
  return moduleMm * (teeth - 2.5);
}

export function baseDiameter(moduleMm: number, teeth: number, pressureAngleDeg: number): number {
  return pitchDiameter(moduleMm, teeth) * Math.cos(pressureAngleDeg * DEG_TO_RAD);
}

export function circularPitch(moduleMm: number): number {
  return Math.PI * moduleMm;
}

export function addendum(moduleMm: number): number {
  return moduleMm;
}

export function dedendum(moduleMm: number): number {
  return 1.25 * moduleMm;
}

export function externalCenterDistance(d1Mm: number, d2Mm: number): number {
  return (d1Mm + d2Mm) / 2;
}

export function internalCenterDistance(dRingMm: number, dExternalMm: number): number {
  return (dRingMm - dExternalMm) / 2;
}

/**
 * Find the teeth counts whose center distance best matches targetCdMm while
 * preserving the current ratio (teeth1 / teeth2 = output / input).
 *
 * Derivation:
 *   CD = module × (teeth1 + teeth2) / 2
 *   teeth1 = ratio × teeth2
 *   → teeth2 = 2×CD / (module × (ratio + 1))
 */
export function teethForCenterDistance(
  targetCdMm: number,
  moduleMm: number,
  ratio: number,
  minTeeth = 8,
  maxTeeth = 200,
): { teeth1: number; teeth2: number } {
  if (targetCdMm <= 0 || moduleMm <= 0 || ratio <= 0) {
    return { teeth1: minTeeth, teeth2: minTeeth };
  }
  const clamp = (n: number) => Math.max(minTeeth, Math.min(maxTeeth, Math.round(n)));
  const teeth2 = clamp((2 * targetCdMm) / (moduleMm * (ratio + 1)));
  const teeth1 = clamp(ratio * teeth2);
  return { teeth1, teeth2 };
}
