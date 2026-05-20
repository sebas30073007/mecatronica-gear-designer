import type { UnitSystem } from './gearTypes';

export const MM_PER_INCH = 25.4;

export function mmToIn(mm: number): number {
  return mm / MM_PER_INCH;
}

/**
 * Format a linear dimension (always stored as mm) for display in the active unit system.
 * dec overrides the default decimal places (metric: 2, imperial: 4 if < 1", else 3).
 */
export function fmtLength(mm: number, system: UnitSystem, dec?: number): string {
  if (system === 'imperial') {
    const v = mmToIn(mm);
    const d = dec ?? (v < 1 ? 4 : 3);
    return `${v.toFixed(d)}"`;
  }
  return `${mm.toFixed(dec ?? 2)} mm`;
}

/**
 * Format a module value (always stored as mm/tooth) for display.
 * Metric: "2.00 mm"  Imperial: "0.0787""
 */
export function fmtModule(moduleMm: number, system: UnitSystem): string {
  if (system === 'imperial') {
    return `${mmToIn(moduleMm).toFixed(4)}"`;
  }
  return `${moduleMm.toFixed(2)} mm`;
}

/** Nice round values for the scale bar, in native display units. */
export const SCALE_NICE_MM: number[] = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500];
export const SCALE_NICE_IN: number[] = [0.1, 0.25, 0.5, 1, 2, 5, 10];

/** Nearest value from a sorted array of candidates. */
export function nearestNice(target: number, candidates: number[]): number {
  return candidates.reduce((best, v) =>
    Math.abs(v - target) < Math.abs(best - target) ? v : best,
  );
}
