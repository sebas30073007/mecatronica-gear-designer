import { pitchRadius, outerDiameter, pitchDiameter, externalCenterDistance } from '../core/gearMath';

export interface PreviewGearParams {
  cx: number;
  cy: number;
  teeth: number;
  moduleMm: number;
  svgScale: number;
}

/**
 * Generates a simplified gear polygon using 4 points per tooth:
 * root-left → tip-left → tip-right → root-right
 * This creates trapezoidal (flat-topped) teeth instead of triangular spikes.
 */
export function makeSimpleGearPath(params: PreviewGearParams): string {
  const { cx, cy, teeth, moduleMm, svgScale } = params;
  const pr   = pitchRadius(moduleMm, teeth) * svgScale;
  const outerR = pr + moduleMm * svgScale;                              // addendum  = 1 × module
  const innerR = Math.max(pr - 1.25 * moduleMm * svgScale, pr * 0.35); // dedendum  = 1.25 × module

  const pitchAngle = (2 * Math.PI) / teeth;
  // Tooth occupies ~40% of pitch at tip, ~52% at root. Gap is the rest.
  const tipHalf  = 0.20 * pitchAngle;
  const rootHalf = 0.26 * pitchAngle;

  let d = '';
  let first = true;

  for (let i = 0; i < teeth; i++) {
    const center = -Math.PI / 2 + i * pitchAngle;

    // 4 points per tooth: trapezoid shape
    const pts: Array<{ r: number; a: number }> = [
      { r: innerR, a: center - rootHalf }, // root-left  (flank start)
      { r: outerR, a: center - tipHalf  }, // tip-left
      { r: outerR, a: center + tipHalf  }, // tip-right
      { r: innerR, a: center + rootHalf }, // root-right (flank end)
    ];

    for (const { r, a } of pts) {
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      d += `${first ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `;
      first = false;
    }
  }

  return d + 'Z';
}

export function makeGearHolePath(cx: number, cy: number, boreDiameterMm: number, svgScale: number): string {
  const r = (boreDiameterMm / 2) * svgScale;
  return [
    `M ${(cx + r).toFixed(2)} ${cy}`,
    `A ${r} ${r} 0 1 0 ${(cx - r).toFixed(2)} ${cy}`,
    `A ${r} ${r} 0 1 0 ${(cx + r).toFixed(2)} ${cy} Z`,
  ].join(' ');
}

export function gearPitchCircleRadius(teeth: number, moduleMm: number, svgScale: number): number {
  return pitchRadius(moduleMm, teeth) * svgScale;
}

// ─── Auto-layout ─────────────────────────────────────────────────────────────

export interface GearLayout {
  cx1: number;
  cy1: number;
  cx2: number;
  cy2: number;
  svgScale: number;
}

// g1 (output/large) as anchor; g2 (input/small) placed toward bottom-left.
const LAYOUT_ANGLE_DEG = 215;

/**
 * Computes gear center positions and an svgScale so both gears fit inside
 * the given viewBox with the specified margin (pixels).
 */
export function layoutTwoGears(
  teeth1: number,
  teeth2: number,
  moduleMm: number,
  viewW: number,
  viewH: number,
  margin = 32,
): GearLayout {
  const angle = LAYOUT_ANGLE_DEG * (Math.PI / 180);

  const d1 = pitchDiameter(moduleMm, teeth1);
  const d2 = pitchDiameter(moduleMm, teeth2);
  const cd = externalCenterDistance(d1, d2); // mm

  const r1mm = outerDiameter(moduleMm, teeth1) / 2;
  const r2mm = outerDiameter(moduleMm, teeth2) / 2;

  // g1 at origin (mm-space), g2 displaced by center distance at layout angle
  const cdx = cd * Math.cos(angle); // → left  (negative)
  const cdy = cd * Math.sin(angle); // → down  (positive in SVG y-down)

  // Axis-aligned bounding box of both gears
  const minX = Math.min(-r1mm, cdx - r2mm);
  const maxX = Math.max(r1mm,  cdx + r2mm);
  const minY = Math.min(-r1mm, cdy - r2mm);
  const maxY = Math.max(r1mm,  cdy + r2mm);

  const scale = Math.min(
    (viewW - 2 * margin) / (maxX - minX),
    (viewH - 2 * margin) / (maxY - minY),
  );

  // Center the result in the viewBox
  const ox = (viewW - (maxX - minX) * scale) / 2 - minX * scale;
  const oy = (viewH - (maxY - minY) * scale) / 2 - minY * scale;

  return {
    cx1: ox,
    cy1: oy,
    cx2: ox + cdx * scale,
    cy2: oy + cdy * scale,
    svgScale: scale,
  };
}
