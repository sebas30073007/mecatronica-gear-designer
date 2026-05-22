/**
 * SVG export at 1:1 scale (1 SVG unit = 1 mm).
 * Layers: construction (root/base), pitch, cut (outline + bore).
 */

import { generateSpurGearOutline } from '../geometry/spurGear2D';
import { pointsToSvgPath } from '../geometry/polar';
import type { Point2D } from '../geometry/polar';

export interface GearExportParams {
  teeth: number;
  moduleMm: number;
  pressureAngleDeg: number;
  boreDiameterMm: number;
  label?: string;
}

export interface SvgExportOptions {
  marginMm?: number;
  quality?: number;
  showConstruction?: boolean;
  showPitchCircle?: boolean;
  showLabels?: boolean;
  kerfOffsetMm?: number;  // shrinks outline + expands bore by this amount
}

// Inward point offset for laser kerf compensation
function applyKerfToOutline(points: import('../geometry/polar').Point2D[], kerf: number): import('../geometry/polar').Point2D[] {
  if (!kerf) return points;
  const N = points.length;
  return points.map((p, i) => {
    const prev = points[(i - 1 + N) % N]!;
    const next = points[(i + 1) % N]!;
    const e1x = p.x - prev.x, e1y = p.y - prev.y;
    const e2x = next.x - p.x, e2y = next.y - p.y;
    const l1 = Math.hypot(e1x, e1y) || 1, l2 = Math.hypot(e2x, e2y) || 1;
    // Inward normal = rotate tangent CW (for CCW polygon)
    const nx = (e1y / l1 + e2y / l2) / 2;
    const ny = (-e1x / l1 - e2x / l2) / 2;
    const nl = Math.hypot(nx, ny) || 1;
    return { x: p.x + (nx / nl) * kerf, y: p.y + (ny / nl) * kerf };
  });
}

const f = (n: number) => n.toFixed(3);

// Convert math-coord outline (Y up, centered at origin) to absolute SVG path.
function toAbsPath(outline: Point2D[], cx: number, cy: number): string {
  return pointsToSvgPath(outline.map(p => ({ x: cx + p.x, y: cy - p.y })));
}

// Full-circle path via two 180° arcs (SVG doesn't close single-arc circles).
function circlePath(cx: number, cy: number, r: number): string {
  const [x0, x1, y] = [(cx + r).toFixed(3), (cx - r).toFixed(3), cy.toFixed(3)];
  const rs = r.toFixed(3);
  return `M ${x0},${y} A ${rs},${rs} 0 1 0 ${x1},${y} A ${rs},${rs} 0 1 0 ${x0},${y} Z`;
}

function constructionGroup(circles: Array<{ cx: number; cy: number; r: number; color: string; dash: string }>): string {
  const lines = circles.map(({ cx, cy, r, color, dash }) =>
    `    <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" stroke="${color}" stroke-width="0.15" stroke-dasharray="${dash}" fill="none"/>`
  ).join('\n');
  return `  <g id="layer-construction" opacity="0.65">\n${lines}\n  </g>`;
}

function pitchGroup(circles: Array<{ cx: number; cy: number; r: number }>, axisLine?: string): string {
  const arcs = circles.map(({ cx, cy, r }) =>
    `    <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" stroke="#cc0000" stroke-width="0.2" stroke-dasharray="3 2" fill="none" opacity="0.75"/>`
  ).join('\n');
  return `  <g id="layer-pitch">\n${arcs}${axisLine ?? ''}\n  </g>`;
}

function centerMark(cx: number, cy: number, size = 2.5): string {
  return [
    `    <line x1="${f(cx - size)}" y1="${f(cy)}" x2="${f(cx + size)}" y2="${f(cy)}"/>`,
    `    <line x1="${f(cx)}" y1="${f(cy - size)}" x2="${f(cx)}" y2="${f(cy + size)}"/>`,
  ].join('\n');
}

// ─── Single gear ──────────────────────────────────────────────────────────────

export function exportSingleGearSvg(params: GearExportParams, opts: SvgExportOptions = {}): string {
  const { marginMm = 6, quality = 24, showConstruction = true, showPitchCircle = true,
          showLabels = false, kerfOffsetMm = 0 } = opts;

  const geo  = generateSpurGearOutline({ ...params, quality });
  const size = (geo.outerRadius + marginMm) * 2;
  const cx = size / 2, cy = size / 2;

  // Apply kerf to outline points (inward) and expand bore
  const outlinePoints = applyKerfToOutline(geo.outline, kerfOffsetMm);
  const boreR = params.boreDiameterMm / 2 + kerfOffsetMm;

  const label = params.label ?? `Gear-${params.teeth}T-M${params.moduleMm}`;
  const date  = new Date().toISOString().split('T')[0]!;

  const construction = showConstruction ? constructionGroup([
    { cx, cy, r: geo.rootRadius, color: '#0066cc', dash: '2 1' },
    { cx, cy, r: geo.baseRadius, color: '#009933', dash: '1 2' },
  ]) : '';

  const pitch = showPitchCircle ? pitchGroup([{ cx, cy, r: geo.pitchRadius }]) : '';

  const labelText = showLabels
    ? `  <g id="layer-labels" font-family="monospace" fill="#666666">\n    <text x="${f(cx)}" y="${f(size - 1)}" text-anchor="middle" font-size="3.5">z=${params.teeth}  m=${params.moduleMm}  PA=${params.pressureAngleDeg}°  Ø${f(geo.pitchRadius * 2)}mm</text>\n  </g>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${f(size)}mm" height="${f(size)}mm"
     viewBox="0 0 ${f(size)} ${f(size)}">
  <title>${label}</title>
  <desc>Module: ${params.moduleMm} mm | Teeth: ${params.teeth} | PA: ${params.pressureAngleDeg}° | Pitch Ø: ${f(geo.pitchRadius * 2)} mm | Outer Ø: ${f(geo.outerRadius * 2)} mm | Root Ø: ${f(geo.rootRadius * 2)} mm${kerfOffsetMm ? ` | Kerf: ${kerfOffsetMm} mm` : ''} | Generated: ${date}</desc>
${construction}
${pitch}
  <g id="layer-cut" fill="none" stroke="#000000" stroke-width="0.1" stroke-linejoin="round" stroke-linecap="round">
    <path id="gear-outline" d="${toAbsPath(outlinePoints, cx, cy)}"/>
    <path id="bore" d="${circlePath(cx, cy, boreR)}"/>
  </g>
  <g id="center-mark" stroke="#cc0000" stroke-width="0.15" opacity="0.5">
${centerMark(cx, cy)}
  </g>
${labelText}
</svg>`;
}

// ─── Gear pair ────────────────────────────────────────────────────────────────

export function exportGearPairSvg(
  gear1: GearExportParams,
  gear2: GearExportParams,
  opts: SvgExportOptions & { layoutAngleDeg?: number } = {},
): string {
  const { marginMm = 6, quality = 24, showConstruction = true, showPitchCircle = true,
          showLabels = false, kerfOffsetMm = 0, layoutAngleDeg = 215 } = opts;

  const geo1 = generateSpurGearOutline({ ...gear1, quality });
  const geo2 = generateSpurGearOutline({ ...gear2, quality });

  const angle = layoutAngleDeg * (Math.PI / 180);
  const cd    = geo1.pitchRadius + geo2.pitchRadius;
  const dx    = cd * Math.cos(angle);   // math coords (Y up)
  const dy    = cd * Math.sin(angle);

  // Bounding box in math coords with margin
  const r1 = geo1.outerRadius, r2 = geo2.outerRadius;
  const minX = Math.min(-r1, dx - r2) - marginMm;
  const maxX = Math.max( r1, dx + r2) + marginMm;
  const minY = Math.min(-r1, dy - r2) - marginMm;
  const maxY = Math.max( r1, dy + r2) + marginMm;

  const W = maxX - minX, H = maxY - minY;

  // SVG coords: svgX = mathX − minX,  svgY = maxY − mathY  (Y flip)
  const cx1 = 0  - minX,  cy1 = maxY - 0;
  const cx2 = dx - minX,  cy2 = maxY - dy;

  const date  = new Date().toISOString().split('T')[0]!;
  const label = `Gear-Pair_${gear1.teeth}T-${gear2.teeth}T_M${gear1.moduleMm}`;

  const construction = showConstruction ? constructionGroup([
    { cx: cx1, cy: cy1, r: geo1.rootRadius, color: '#0066cc', dash: '2 1' },
    { cx: cx1, cy: cy1, r: geo1.baseRadius, color: '#009933', dash: '1 2' },
    { cx: cx2, cy: cy2, r: geo2.rootRadius, color: '#0066cc', dash: '2 1' },
    { cx: cx2, cy: cy2, r: geo2.baseRadius, color: '#009933', dash: '1 2' },
  ]) : '';

  const axisLine = `\n    <line x1="${f(cx1)}" y1="${f(cy1)}" x2="${f(cx2)}" y2="${f(cy2)}" stroke="#cc0000" stroke-width="0.15" stroke-dasharray="4 2" opacity="0.4"/>`;
  const pitch = showPitchCircle ? pitchGroup(
    [{ cx: cx1, cy: cy1, r: geo1.pitchRadius }, { cx: cx2, cy: cy2, r: geo2.pitchRadius }],
    axisLine,
  ) : '';

  const out1 = applyKerfToOutline(geo1.outline, kerfOffsetMm);
  const out2 = applyKerfToOutline(geo2.outline, kerfOffsetMm);
  const bore1R = gear1.boreDiameterMm / 2 + kerfOffsetMm;
  const bore2R = gear2.boreDiameterMm / 2 + kerfOffsetMm;

  const pairLabel = showLabels
    ? `  <g id="layer-labels" font-family="monospace" fill="#666666">` +
      `\n    <text x="${f(cx1)}" y="${f(H - 1)}" text-anchor="middle" font-size="3">z=${gear1.teeth}</text>` +
      `\n    <text x="${f(cx2)}" y="${f(H - 1)}" text-anchor="middle" font-size="3">z=${gear2.teeth}</text>` +
      `\n    <text x="${f(W/2)}" y="${f(1.5)}" text-anchor="middle" font-size="3">m=${gear1.moduleMm}  i=${(gear1.teeth/gear2.teeth).toFixed(2)}  cd=${f(cd)}</text>` +
      `\n  </g>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${f(W)}mm" height="${f(H)}mm"
     viewBox="0 0 ${f(W)} ${f(H)}">
  <title>${label}</title>
  <desc>Output: ${gear1.teeth}T | Input: ${gear2.teeth}T | Module: ${gear1.moduleMm} mm | PA: ${gear1.pressureAngleDeg}° | Center Distance: ${f(cd)} mm${kerfOffsetMm ? ` | Kerf: ${kerfOffsetMm} mm` : ''} | Generated: ${date}</desc>
${construction}
${pitch}
  <g id="layer-cut" fill="none" stroke="#000000" stroke-width="0.1" stroke-linejoin="round" stroke-linecap="round">
    <path id="gear1-outline" d="${toAbsPath(out1, cx1, cy1)}"/>
    <path id="bore1" d="${circlePath(cx1, cy1, bore1R)}"/>
    <path id="gear2-outline" d="${toAbsPath(out2, cx2, cy2)}"/>
    <path id="bore2" d="${circlePath(cx2, cy2, bore2R)}"/>
  </g>
  <g id="center-marks" stroke="#cc0000" stroke-width="0.15" opacity="0.5">
${centerMark(cx1, cy1)}
${centerMark(cx2, cy2)}
  </g>
${pairLabel}
</svg>`;
}
