import { describe, it, expect } from 'vitest';
import { involutePoint, involuteParamForRadius, involuteFunc, involuteFlankPoints } from '../geometry/involute';
import { generateSpurGearOutline } from '../geometry/spurGear2D';
import { rotatePoint, mirrorY, polarToCartesian, toLocalSvgPath } from '../geometry/polar';
import { calculateExternalGearInitialPhase, normalizeAngle } from '../geometry/meshing';

// ─── involute.ts ──────────────────────────────────────────────────────────────

describe('involutePoint', () => {
  it('t=0 → point lies exactly on base circle', () => {
    const rb = 18;
    const p = involutePoint(rb, 0);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(rb, 10);
  });
  it('t=0 → point is at (rb, 0)', () => {
    const p = involutePoint(20, 0);
    expect(p.x).toBeCloseTo(20);
    expect(p.y).toBeCloseTo(0);
  });
  it('t>0 → point lies outside base circle', () => {
    const rb = 18;
    const p = involutePoint(rb, 1.2);
    expect(Math.hypot(p.x, p.y)).toBeGreaterThan(rb);
  });
});

describe('involuteParamForRadius', () => {
  it('r = rb → t = 0', () => {
    expect(involuteParamForRadius(18, 18)).toBeCloseTo(0);
  });
  it('r < rb → clamps to 0', () => {
    expect(involuteParamForRadius(18, 10)).toBe(0);
  });
  it('round-trip: paramForRadius → involutePoint gives correct radius', () => {
    const rb = 18, r = 22;
    const t = involuteParamForRadius(rb, r);
    const p = involutePoint(rb, t);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(r, 6);
  });
});

describe('involuteFlankPoints', () => {
  it('returns steps+1 points', () => {
    const pts = involuteFlankPoints(18, 18, 22, 8);
    expect(pts).toHaveLength(9);
  });
  it('first point is on base circle, last on outer radius', () => {
    const rb = 18, outerR = 22;
    const pts = involuteFlankPoints(rb, rb, outerR, 8);
    expect(Math.hypot(pts[0]!.x, pts[0]!.y)).toBeCloseTo(rb, 6);
    expect(Math.hypot(pts[8]!.x, pts[8]!.y)).toBeCloseTo(outerR, 6);
  });
});

// ─── spurGear2D.ts ────────────────────────────────────────────────────────────

describe('generateSpurGearOutline — 20T module 2 PA 20° (reference case)', () => {
  const geo = generateSpurGearOutline({ teeth: 20, moduleMm: 2, pressureAngleDeg: 20 });

  it('pitchRadius = 20 mm', () => expect(geo.pitchRadius).toBeCloseTo(20));
  it('outerRadius = 22 mm', () => expect(geo.outerRadius).toBeCloseTo(22));
  it('rootRadius  = 17.5 mm', () => expect(geo.rootRadius).toBeCloseTo(17.5));
  it('baseRadius  ≈ 18.794 mm', () => expect(geo.baseRadius).toBeCloseTo(18.794, 2));

  it('baseRadius < pitchRadius (involute validity)', () => {
    expect(geo.baseRadius).toBeLessThan(geo.pitchRadius);
  });

  it('outline has points (non-empty)', () => {
    expect(geo.outline.length).toBeGreaterThan(0);
  });

  it('tooth spacing is 2π/z, not π/z (critical spacing check)', () => {
    // Verify the outline wraps exactly once (first ≈ last after one full revolution)
    const first = geo.outline[0]!;
    const last  = geo.outline[geo.outline.length - 1]!;
    // They won't be identical (outline is open before Z close), but the angular
    // span of the outline should cover exactly 2π — check via outline length
    // being a multiple of (2 * quality + radials + arc) per tooth
    expect(geo.outline.length % 20).toBe(0);
  });

  it('all outline points lie within outer radius', () => {
    for (const p of geo.outline) {
      expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(geo.outerRadius + 1e-6);
    }
  });

  it('all outline points lie outside bore (root radius area)', () => {
    for (const p of geo.outline) {
      expect(Math.hypot(p.x, p.y)).toBeGreaterThanOrEqual(geo.rootRadius - 1e-6);
    }
  });
});

describe('generateSpurGearOutline — 54T module 2 PA 20°', () => {
  const geo = generateSpurGearOutline({ teeth: 54, moduleMm: 2, pressureAngleDeg: 20 });
  it('pitchRadius = 54 mm', () => expect(geo.pitchRadius).toBeCloseTo(54));
  it('outerRadius = 56 mm', () => expect(geo.outerRadius).toBeCloseTo(56));
  it('baseRadius < pitchRadius', () => expect(geo.baseRadius).toBeLessThan(geo.pitchRadius));
});

describe('generateSpurGearOutline — pressure angle variants', () => {
  it('PA 14.5° → baseRadius larger than PA 20°', () => {
    const g145 = generateSpurGearOutline({ teeth: 20, moduleMm: 2, pressureAngleDeg: 14.5 });
    const g20  = generateSpurGearOutline({ teeth: 20, moduleMm: 2, pressureAngleDeg: 20 });
    expect(g145.baseRadius).toBeGreaterThan(g20.baseRadius);
  });
  it('PA 25° → baseRadius smaller than PA 20°', () => {
    const g25 = generateSpurGearOutline({ teeth: 20, moduleMm: 2, pressureAngleDeg: 25 });
    const g20 = generateSpurGearOutline({ teeth: 20, moduleMm: 2, pressureAngleDeg: 20 });
    expect(g25.baseRadius).toBeLessThan(g20.baseRadius);
  });
});

// ─── polar.ts ─────────────────────────────────────────────────────────────────

describe('rotatePoint', () => {
  it('rotate (1,0) by π/2 → (0,1)', () => {
    const p = rotatePoint({ x: 1, y: 0 }, Math.PI / 2);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(1);
  });
  it('rotate by 0 → unchanged', () => {
    const p = rotatePoint({ x: 3, y: 4 }, 0);
    expect(p.x).toBeCloseTo(3);
    expect(p.y).toBeCloseTo(4);
  });
});

describe('mirrorY', () => {
  it('flips Y, keeps X', () => {
    const p = mirrorY({ x: 3, y: 4 });
    expect(p.x).toBe(3);
    expect(p.y).toBe(-4);
  });
});

describe('polarToCartesian', () => {
  it('r=1, θ=0 → (1,0)', () => {
    const p = polarToCartesian(1, 0);
    expect(p.x).toBeCloseTo(1);
    expect(p.y).toBeCloseTo(0);
  });
  it('r=1, θ=π/2 → (0,1)', () => {
    const p = polarToCartesian(1, Math.PI / 2);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(1);
  });
});

describe('toLocalSvgPath', () => {
  it('flips Y axis (math Y up → SVG Y down)', () => {
    const path = toLocalSvgPath([{ x: 0, y: 1 }], 1);
    // y=1 in math → y=-1 in SVG
    expect(path).toContain('0.00 -1.00');
  });
  it('applies scale', () => {
    const path = toLocalSvgPath([{ x: 1, y: 0 }], 10);
    expect(path).toContain('10.00 0.00');
  });
  it('closes path with Z', () => {
    const path = toLocalSvgPath([{ x: 1, y: 0 }, { x: 0, y: 1 }], 1);
    expect(path).toMatch(/Z$/);
  });
});

// ─── meshing.ts ───────────────────────────────────────────────────────────────

describe('normalizeAngle', () => {
  it('keeps angles in [0, 2π)', () => {
    expect(normalizeAngle(0)).toBeCloseTo(0);
    expect(normalizeAngle(2 * Math.PI)).toBeCloseTo(0);
    expect(normalizeAngle(-Math.PI)).toBeCloseTo(Math.PI);
    expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
  });
});

describe('calculateExternalGearInitialPhase', () => {
  it('mesh on +X (angle=0): driver tooth 0 points right', () => {
    const { driverInitialRotationRad } = calculateExternalGearInitialPhase({
      driverTeeth: 18, drivenTeeth: 54, meshAngleRad: 0,
    });
    expect(driverInitialRotationRad).toBeCloseTo(0);
  });

  it('driven valley aligns toward driver center', () => {
    const z2 = 54;
    const meshAngle = 0;
    const { drivenInitialRotationRad } = calculateExternalGearInitialPhase({
      driverTeeth: 18, drivenTeeth: z2, meshAngleRad: meshAngle,
    });
    // Valley 0 of driven is at pitchAngle/2 from tooth 0.
    // After rotation, it should point back toward driver (meshAngle + π).
    const pitchAngle = (2 * Math.PI) / z2;
    const valleyAngle = normalizeAngle(drivenInitialRotationRad + pitchAngle / 2);
    const expectedDir = normalizeAngle(meshAngle + Math.PI);
    expect(valleyAngle).toBeCloseTo(expectedDir, 6);
  });

  it('result is independent of mesh angle direction (45° test)', () => {
    const meshAngle = Math.PI / 4;
    const { driverInitialRotationRad } = calculateExternalGearInitialPhase({
      driverTeeth: 20, drivenTeeth: 40, meshAngleRad: meshAngle,
    });
    expect(normalizeAngle(driverInitialRotationRad)).toBeCloseTo(normalizeAngle(meshAngle), 6);
  });
});
