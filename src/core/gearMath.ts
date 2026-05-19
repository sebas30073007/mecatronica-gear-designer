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
