/**
 * SVG export at 1:1 scale (1 SVG unit = 1 mm).
 * Layers: construction (root/base), pitch, cut (outline + bore).
 */

import { generateSpurGearOutline } from '../geometry/spurGear2D';
import { generateBoreOutline } from '../geometry/borePath';
import { pointsToSvgPath } from '../geometry/polar';
import type { Point2D } from '../geometry/polar';
import type { BoreType, PlanetaryParams } from '../core/gearTypes';
import { planetaryRingTeeth } from '../core/gearTypes';

export interface GearExportParams {
  teeth: number;
  moduleMm: number;
  pressureAngleDeg: number;
  boreDiameterMm: number;
  boreType?: BoreType;
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

function boreSvgPath(type: BoreType, diameterMm: number, cx: number, cy: number): string {
  if (type === 'none' || diameterMm <= 0) return '';
  if (type === 'round') return circlePath(cx, cy, diameterMm / 2);
  const pts = generateBoreOutline(type, diameterMm);
  return pts.length ? toAbsPath(pts, cx, cy) : circlePath(cx, cy, diameterMm / 2);
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

  const outlinePoints = applyKerfToOutline(geo.outline, kerfOffsetMm);
  const boreEffD = params.boreDiameterMm + kerfOffsetMm * 2;
  const boreType = params.boreType ?? 'round';

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
    <path id="bore" d="${boreSvgPath(boreType, boreEffD, cx, cy)}"/>
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

  const out1   = applyKerfToOutline(geo1.outline, kerfOffsetMm);
  const out2   = applyKerfToOutline(geo2.outline, kerfOffsetMm);
  const bore1D = gear1.boreDiameterMm + kerfOffsetMm * 2;
  const bore2D = gear2.boreDiameterMm + kerfOffsetMm * 2;
  const boreType1 = gear1.boreType ?? 'round';
  const boreType2 = gear2.boreType ?? 'round';

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
    <path id="bore1" d="${boreSvgPath(boreType1, bore1D, cx1, cy1)}"/>
    <path id="gear2-outline" d="${toAbsPath(out2, cx2, cy2)}"/>
    <path id="bore2" d="${boreSvgPath(boreType2, bore2D, cx2, cy2)}"/>
  </g>
  <g id="center-marks" stroke="#cc0000" stroke-width="0.15" opacity="0.5">
${centerMark(cx1, cy1)}
${centerMark(cx2, cy2)}
  </g>
${pairLabel}
</svg>`;
}

// ─── Planetary gear set ───────────────────────────────────────────────────────

function gearPathAt(outline: Point2D[], cx: number, cy: number, phaseRad = 0): string {
  if (phaseRad === 0) return toAbsPath(outline, cx, cy);
  const rotated = outline.map(p => {
    const r = Math.hypot(p.x, p.y), a = Math.atan2(p.y, p.x) + phaseRad;
    return { x: r * Math.cos(a), y: r * Math.sin(a) };
  });
  return toAbsPath(rotated, cx, cy);
}

/** Complete assembly view (combined) or individual component. */
export function exportPlanetarySvg(params: PlanetaryParams, opts: SvgExportOptions = {}): string {
  const { marginMm = 8, quality = 24, showConstruction = true,
          showPitchCircle = true, showLabels = false } = opts;
  const { sunTeeth, planetTeeth, planetCount, moduleMm, pressureAngleDeg } = params;
  const ringTeeth = planetaryRingTeeth(params);
  const r_sun     = sunTeeth    * moduleMm / 2;
  const r_planet  = planetTeeth * moduleMm / 2;
  const r_ring    = ringTeeth   * moduleMm / 2;
  const orbit_r   = r_sun + r_planet;
  const r_wall    = (ringTeeth + 2.5) * moduleMm / 2 + 3;  // outer wall of ring gear

  const totalR = r_wall + marginMm;
  const W = totalR * 2, H = totalR * 2;
  const cx = totalR, cy = totalR;

  const sunGeo  = generateSpurGearOutline({ teeth: sunTeeth,    moduleMm, pressureAngleDeg, quality });
  const planGeo = generateSpurGearOutline({ teeth: planetTeeth, moduleMm, pressureAngleDeg, quality });
  const ringGeo = generateSpurGearOutline({ teeth: ringTeeth,   moduleMm, pressureAngleDeg, quality });

  const constructionCircles: Array<{cx:number;cy:number;r:number;color:string;dash:string}> = [];
  const pitchCircles: Array<{cx:number;cy:number;r:number}> = [];
  if (showConstruction) {
    constructionCircles.push(
      { cx, cy, r: sunGeo.rootRadius, color: '#0066cc', dash: '2 1' },
      { cx, cy, r: sunGeo.baseRadius, color: '#009933', dash: '1 2' },
      { cx, cy, r: r_wall, color: '#0066cc', dash: '2 1' },
    );
  }
  if (showPitchCircle) {
    pitchCircles.push({ cx, cy, r: r_sun }, { cx, cy, r: r_ring });
  }

  const planetPathElems: string[] = [];
  for (let i = 0; i < planetCount; i++) {
    const θ  = (i / planetCount) * Math.PI * 2 - Math.PI / 2;
    const px = cx + orbit_r * Math.cos(θ);
    const py = cy - orbit_r * Math.sin(θ);  // SVG Y-flip
    const phase = Math.PI / planetTeeth + (θ + Math.PI);
    planetPathElems.push(`<path id="planet-${i}" d="${gearPathAt(planGeo.outline, px, py, phase)}"/>`);
    if (showConstruction) constructionCircles.push(
      { cx: px, cy: py, r: planGeo.rootRadius, color: '#0066cc', dash: '2 1' },
      { cx: px, cy: py, r: planGeo.baseRadius, color: '#009933', dash: '1 2' },
    );
    if (showPitchCircle) pitchCircles.push({ cx: px, cy: py, r: r_planet });
  }

  const date = new Date().toISOString().split('T')[0]!;
  const labelText = showLabels
    ? `  <g font-family="monospace" fill="#666666" font-size="3.5"><text x="${f(cx)}" y="${f(H-2)}" text-anchor="middle">Sun z=${sunTeeth}  Planet z=${planetTeeth}  Ring z=${ringTeeth}  m=${moduleMm}  ${planetCount}×</text></g>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${f(W)}mm" height="${f(H)}mm"
     viewBox="0 0 ${f(W)} ${f(H)}">
  <title>Planetary-Sun${sunTeeth}-Planet${planetTeeth}-Ring${ringTeeth}-M${moduleMm}</title>
  <desc>Planetary | Sun z=${sunTeeth}, Planet z=${planetTeeth} (${planetCount}×), Ring z=${ringTeeth} | m=${moduleMm} | PA=${pressureAngleDeg}° | Generated: ${date}</desc>
${constructionCircles.length ? constructionGroup(constructionCircles) : ''}
${pitchCircles.length ? pitchGroup(pitchCircles) : ''}
  <g id="layer-cut" fill="none" stroke="#000000" stroke-width="0.1" stroke-linejoin="round" stroke-linecap="round">
    <path id="ring-outer" d="${circlePath(cx, cy, r_wall)}"/>
    <path id="ring-inner" d="${toAbsPath(ringGeo.outline, cx, cy)}"/>
    <path id="sun-gear"   d="${toAbsPath(sunGeo.outline,  cx, cy)}"/>
    ${planetPathElems.join('\n    ')}
  </g>
  <g id="center-mark" stroke="#cc0000" stroke-width="0.15" opacity="0.5">${centerMark(cx, cy)}</g>
${labelText}
</svg>`;
}

/** Sun gear only — uses standard single-gear format. */
export function exportSunGearSvg(p: PlanetaryParams, opts: SvgExportOptions = {}): string {
  return exportSingleGearSvg({
    teeth: p.sunTeeth, moduleMm: p.moduleMm, pressureAngleDeg: p.pressureAngleDeg,
    boreDiameterMm: Math.max(4, p.moduleMm * 2), boreType: 'round',
    label: `Sun-${p.sunTeeth}T-M${p.moduleMm}`,
  }, opts);
}

/** One planet gear — uses standard single-gear format. */
export function exportPlanetGearSvg(p: PlanetaryParams, opts: SvgExportOptions = {}): string {
  return exportSingleGearSvg({
    teeth: p.planetTeeth, moduleMm: p.moduleMm, pressureAngleDeg: p.pressureAngleDeg,
    boreDiameterMm: Math.max(3, p.moduleMm * 1.5), boreType: 'round',
    label: `Planet-${p.planetTeeth}T-M${p.moduleMm}`,
  }, opts);
}

/** Ring gear only — outer wall circle + inner spur profile (the internal teeth). */
export function exportRingGearSvg(p: PlanetaryParams, opts: SvgExportOptions = {}): string {
  const { marginMm = 8, quality = 24, showConstruction = true, showPitchCircle = true } = opts;
  const ringTeeth = planetaryRingTeeth(p);
  const ringGeo   = generateSpurGearOutline({ teeth: ringTeeth, moduleMm: p.moduleMm, pressureAngleDeg: p.pressureAngleDeg, quality });
  const r_wall    = (ringTeeth + 2.5) * p.moduleMm / 2 + 3;
  const totalR = r_wall + marginMm;
  const W = totalR * 2, H = totalR * 2;
  const cx = totalR, cy = totalR;
  const date = new Date().toISOString().split('T')[0]!;

  const construction = showConstruction ? constructionGroup([
    { cx, cy, r: r_wall, color: '#0066cc', dash: '2 1' },
  ]) : '';
  const pitch = showPitchCircle ? pitchGroup([{ cx, cy, r: ringTeeth * p.moduleMm / 2 }]) : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${f(W)}mm" height="${f(H)}mm"
     viewBox="0 0 ${f(W)} ${f(H)}">
  <title>Ring-Gear-${ringTeeth}T-M${p.moduleMm}</title>
  <desc>Internal Ring Gear | z=${ringTeeth} | m=${p.moduleMm} | PA=${p.pressureAngleDeg}° | Outer Ø ${f(r_wall*2)} mm | Generated: ${date}</desc>
${construction}
${pitch}
  <g id="layer-cut" fill="none" stroke="#000000" stroke-width="0.1" stroke-linejoin="round" stroke-linecap="round">
    <path id="ring-outer" d="${circlePath(cx, cy, r_wall)}"/>
    <path id="ring-inner" d="${toAbsPath(ringGeo.outline, cx, cy)}"/>
  </g>
  <g id="center-mark" stroke="#cc0000" stroke-width="0.15" opacity="0.5">${centerMark(cx, cy)}</g>
</svg>`;
}
