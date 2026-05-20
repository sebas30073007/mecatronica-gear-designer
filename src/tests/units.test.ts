import { describe, it, expect } from 'vitest';
import { mmToIn, fmtLength, fmtModule, nearestNice, SCALE_NICE_MM, SCALE_NICE_IN, MM_PER_INCH } from '../core/units';

describe('mmToIn', () => {
  it('converts 25.4 mm to exactly 1 inch', () => {
    expect(mmToIn(25.4)).toBeCloseTo(1.0);
  });
  it('converts 0 to 0', () => {
    expect(mmToIn(0)).toBe(0);
  });
});

describe('fmtLength', () => {
  it('formats metric with 2 decimal places', () => {
    expect(fmtLength(108, 'metric')).toBe('108.00 mm');
  });
  it('formats metric with custom decimals', () => {
    expect(fmtLength(108, 'metric', 1)).toBe('108.0 mm');
  });
  it('formats imperial ≥ 1 inch with 3 decimal places', () => {
    expect(fmtLength(25.4, 'imperial')).toBe('1.000"');
  });
  it('formats imperial < 1 inch with 4 decimal places', () => {
    expect(fmtLength(10, 'imperial')).toBe('0.3937"');
  });
  it('formats imperial with explicit dec override', () => {
    expect(fmtLength(25.4, 'imperial', 2)).toBe('1.00"');
  });
});

describe('fmtModule', () => {
  it('formats metric module', () => {
    expect(fmtModule(2, 'metric')).toBe('2.00 mm');
  });
  it('formats imperial module in inches', () => {
    const result = fmtModule(2, 'imperial');
    expect(result).toBe(`${(2 / MM_PER_INCH).toFixed(4)}"`);
  });
});

describe('nearestNice', () => {
  it('finds nearest mm nice value', () => {
    expect(nearestNice(9, SCALE_NICE_MM)).toBe(10);
    expect(nearestNice(24, SCALE_NICE_MM)).toBe(25);
    expect(nearestNice(3, SCALE_NICE_MM)).toBe(2);
  });
  it('finds nearest inch nice value', () => {
    expect(nearestNice(0.3, SCALE_NICE_IN)).toBe(0.25);
    expect(nearestNice(0.8, SCALE_NICE_IN)).toBe(1);
  });
});
