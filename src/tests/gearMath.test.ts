import { describe, it, expect } from 'vitest';
import {
  pitchDiameter,
  pitchRadius,
  outerDiameter,
  rootDiameter,
  baseDiameter,
  circularPitch,
  addendum,
  dedendum,
  externalCenterDistance,
  internalCenterDistance,
  teethForCenterDistance,
} from '../core/gearMath';

describe('pitchDiameter', () => {
  it('module 2, 18 teeth → 36 mm', () => {
    expect(pitchDiameter(2, 18)).toBe(36);
  });
  it('module 2, 54 teeth → 108 mm', () => {
    expect(pitchDiameter(2, 54)).toBe(108);
  });
  it('module 3, 20 teeth → 60 mm', () => {
    expect(pitchDiameter(3, 20)).toBe(60);
  });
});

describe('pitchRadius', () => {
  it('module 2, 18 teeth → 18 mm', () => {
    expect(pitchRadius(2, 18)).toBe(18);
  });
});

describe('outerDiameter', () => {
  it('module 2, 18 teeth → 40 mm', () => {
    expect(outerDiameter(2, 18)).toBe(40);
  });
  it('module 2, 54 teeth → 112 mm', () => {
    expect(outerDiameter(2, 54)).toBe(112);
  });
});

describe('rootDiameter', () => {
  it('module 2, 18 teeth → 31 mm', () => {
    expect(rootDiameter(2, 18)).toBeCloseTo(31, 1);
  });
  it('module 2, 54 teeth → 103 mm', () => {
    expect(rootDiameter(2, 54)).toBeCloseTo(103, 1);
  });
});

describe('baseDiameter', () => {
  it('module 2, 18 teeth, 20° → ~33.83 mm', () => {
    expect(baseDiameter(2, 18, 20)).toBeCloseTo(33.83, 1);
  });
  it('module 2, 18 teeth, 14.5° → ~34.88 mm', () => {
    expect(baseDiameter(2, 18, 14.5)).toBeCloseTo(34.88, 1);
  });
});

describe('circularPitch', () => {
  it('module 2 → π*2 mm', () => {
    expect(circularPitch(2)).toBeCloseTo(Math.PI * 2, 5);
  });
});

describe('addendum & dedendum', () => {
  it('addendum = module', () => {
    expect(addendum(2)).toBe(2);
  });
  it('dedendum = 1.25 * module', () => {
    expect(dedendum(2)).toBe(2.5);
  });
});

describe('externalCenterDistance', () => {
  it('(36, 108) → 72 mm', () => {
    expect(externalCenterDistance(36, 108)).toBe(72);
  });
  it('symmetric pair (60, 60) → 60 mm', () => {
    expect(externalCenterDistance(60, 60)).toBe(60);
  });
});

describe('internalCenterDistance', () => {
  it('ring 120mm, external 36mm → 42 mm', () => {
    expect(internalCenterDistance(120, 36)).toBe(42);
  });
});

describe('teethForCenterDistance', () => {
  it('recovers original teeth for exact CD (ratio 3, module 2, CD 72mm)', () => {
    const { teeth1, teeth2 } = teethForCenterDistance(72, 2, 3);
    expect(teeth1).toBe(54);
    expect(teeth2).toBe(18);
  });
  it('produced CD is exact when teeth divide evenly', () => {
    const { teeth1, teeth2 } = teethForCenterDistance(60, 2, 3);
    expect(externalCenterDistance(pitchDiameter(2, teeth1), pitchDiameter(2, teeth2))).toBe(60);
  });
  it('ratio is approximately preserved', () => {
    const { teeth1, teeth2 } = teethForCenterDistance(100, 2, 3);
    expect(teeth1 / teeth2).toBeCloseTo(3, 0);
  });
  it('clamps teeth to minimum when CD is tiny', () => {
    const { teeth1, teeth2 } = teethForCenterDistance(1, 2, 3);
    expect(teeth1).toBeGreaterThanOrEqual(8);
    expect(teeth2).toBeGreaterThanOrEqual(8);
  });
  it('returns minTeeth for invalid inputs', () => {
    const r = teethForCenterDistance(0, 2, 3);
    expect(r.teeth1).toBe(8);
    expect(r.teeth2).toBe(8);
  });
});
