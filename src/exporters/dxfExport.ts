/**
 * DXF R12 (AC1009) ASCII export — 1:1 scale (1 unit = 1 mm, Y axis up).
 * Layers: CUT (gear outline), BORE (bore circle), CONSTRUCTION (pitch/root/base + center mark).
 */

import { generateSpurGearOutline } from '../geometry/spurGear2D';
import { generateBoreOutline } from '../geometry/borePath';
import type { GearExportParams } from './svgExport';
import type { PlanetaryParams } from '../core/gearTypes';
import { planetaryRingTeeth } from '../core/gearTypes';

export interface DxfExportOptions {
  showConstruction?: boolean;
  showPitchCircle?: boolean;
  kerfOffsetMm?: number;  // applied in R3 — field accepted but not yet used
}

const f = (n: number) => n.toFixed(4);

// ── DXF R12 primitives ────────────────────────────────────────────────────────

function dxfLine(x1: number, y1: number, x2: number, y2: number, layer: string): string {
  return `0\nLINE\n8\n${layer}\n10\n${f(x1)}\n20\n${f(y1)}\n30\n0.0000\n11\n${f(x2)}\n21\n${f(y2)}\n31\n0.0000\n`;
}

function dxfCircle(cx: number, cy: number, r: number, layer: string): string {
  return `0\nCIRCLE\n8\n${layer}\n10\n${f(cx)}\n20\n${f(cy)}\n30\n0.0000\n40\n${f(r)}\n`;
}

function dxfPolyline(pts: Array<{ x: number; y: number }>, layer: string): string {
  // R12 POLYLINE header requires a dummy 10/20/30 position before the 66/70 flags.
  const header = `0\nPOLYLINE\n8\n${layer}\n10\n0.0000\n20\n0.0000\n30\n0.0000\n66\n1\n70\n1\n`;
  const verts = pts.map(p =>
    `0\nVERTEX\n8\n${layer}\n10\n${f(p.x)}\n20\n${f(p.y)}\n30\n0.0000\n`,
  ).join('');
  return `${header}${verts}0\nSEQEND\n8\n${layer}\n`;
}

function dxfBore(params: GearExportParams, cx: number, cy: number): string {
  const type = params.boreType ?? 'round';
  const d = params.boreDiameterMm;
  if (type === 'none') return '';
  if (type === 'round') return dxfCircle(cx, cy, d / 2, 'BORE');
  const pts = generateBoreOutline(type, d).map(p => ({ x: cx + p.x, y: cy + p.y }));
  return pts.length ? dxfPolyline(pts, 'BORE') : dxfCircle(cx, cy, d / 2, 'BORE');
}

function dxfLayerDef(name: string, color: number): string {
  return `0\nLAYER\n2\n${name}\n70\n0\n62\n${color}\n6\nCONTINUOUS\n`;
}

function dxfHeader(): string {
  // $INSUNITS is NOT in the R12 (AC1009) spec — omit it to avoid parser desync.
  return `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n`;
}

function dxfTables(layerDefs: string[]): string {
  // Layer "0" is the mandatory default layer in every DXF file.
  const all = [dxfLayerDef('0', 7), ...layerDefs];
  return (
    `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${all.length}\n` +
    all.join('') +
    `0\nENDTAB\n0\nENDSEC\n`
  );
}

function centerLines(cx: number, cy: number): string[] {
  const s = 3;
  return [
    dxfLine(cx - s, cy, cx + s, cy, 'CONSTRUCTION'),
    dxfLine(cx, cy - s, cx, cy + s, 'CONSTRUCTION'),
  ];
}

function buildDxf(entities: string[]): string {
  const layers = [
    dxfLayerDef('CUT', 7),          // white/black — outline
    dxfLayerDef('BORE', 5),         // blue — bore
    dxfLayerDef('CONSTRUCTION', 2), // yellow — pitch/root/base/center
  ];
  // R12 section order: HEADER → TABLES → BLOCKS → ENTITIES → EOF.
  // BLOCKS must be present (even empty) or ENTITIES won't parse correctly.
  return [
    dxfHeader(),
    dxfTables(layers),
    `0\nSECTION\n2\nBLOCKS\n0\nENDSEC\n`,
    `0\nSECTION\n2\nENTITIES\n`,
    ...entities,
    `0\nENDSEC\n0\nEOF\n`,
  ].join('');
}

// ── Single gear ───────────────────────────────────────────────────────────────

export function exportSingleGearDxf(params: GearExportParams, opts: DxfExportOptions = {}): string {
  const { showConstruction = true, showPitchCircle = true } = opts;
  const geo = generateSpurGearOutline({ ...params, quality: 24 });

  const entities: string[] = [
    dxfPolyline(geo.outline, 'CUT'),
    dxfBore(params, 0, 0),
  ];

  if (showPitchCircle)  entities.push(dxfCircle(0, 0, geo.pitchRadius, 'CONSTRUCTION'));
  if (showConstruction) {
    entities.push(dxfCircle(0, 0, geo.rootRadius, 'CONSTRUCTION'));
    entities.push(dxfCircle(0, 0, geo.baseRadius, 'CONSTRUCTION'));
  }
  entities.push(...centerLines(0, 0));

  return buildDxf(entities);
}

// ── Gear pair ─────────────────────────────────────────────────────────────────

export function exportGearPairDxf(
  gear1: GearExportParams,
  gear2: GearExportParams,
  opts: DxfExportOptions & { layoutAngleDeg?: number } = {},
): string {
  const { showConstruction = true, showPitchCircle = true, layoutAngleDeg = 215 } = opts;

  const geo1 = generateSpurGearOutline({ ...gear1, quality: 24 });
  const geo2 = generateSpurGearOutline({ ...gear2, quality: 24 });

  const angle = layoutAngleDeg * (Math.PI / 180);
  const cd    = geo1.pitchRadius + geo2.pitchRadius;
  const cx2   = cd * Math.cos(angle);
  const cy2   = cd * Math.sin(angle);

  const entities: string[] = [
    // Outlines
    dxfPolyline(geo1.outline, 'CUT'),
    dxfPolyline(geo2.outline.map(p => ({ x: p.x + cx2, y: p.y + cy2 })), 'CUT'),
    // Bores
    dxfBore(gear1, 0, 0),
    dxfBore(gear2, cx2, cy2),
  ];

  if (showPitchCircle) {
    entities.push(dxfCircle(0, 0, geo1.pitchRadius, 'CONSTRUCTION'));
    entities.push(dxfCircle(cx2, cy2, geo2.pitchRadius, 'CONSTRUCTION'));
    entities.push(dxfLine(0, 0, cx2, cy2, 'CONSTRUCTION')); // axis between centers
  }
  if (showConstruction) {
    entities.push(dxfCircle(0, 0, geo1.rootRadius, 'CONSTRUCTION'));
    entities.push(dxfCircle(0, 0, geo1.baseRadius, 'CONSTRUCTION'));
    entities.push(dxfCircle(cx2, cy2, geo2.rootRadius, 'CONSTRUCTION'));
    entities.push(dxfCircle(cx2, cy2, geo2.baseRadius, 'CONSTRUCTION'));
  }
  entities.push(...centerLines(0, 0), ...centerLines(cx2, cy2));

  return buildDxf(entities);
}

// ── Planetary gear set ────────────────────────────────────────────────────────

/** Full assembly DXF (combined). */
export function exportPlanetaryDxf(params: PlanetaryParams, opts: DxfExportOptions = {}): string {
  const { sunTeeth, planetTeeth, planetCount, moduleMm, pressureAngleDeg } = params;
  const { showConstruction = true, showPitchCircle = true } = opts;
  const ringTeeth = planetaryRingTeeth(params);
  const orbit_r   = (sunTeeth + planetTeeth) * moduleMm / 2;
  const r_wall    = (ringTeeth + 2.5) * moduleMm / 2 + 3;

  const sunGeo  = generateSpurGearOutline({ teeth: sunTeeth,    moduleMm, pressureAngleDeg, quality: 24 });
  const planGeo = generateSpurGearOutline({ teeth: planetTeeth, moduleMm, pressureAngleDeg, quality: 24 });
  const ringGeo = generateSpurGearOutline({ teeth: ringTeeth,   moduleMm, pressureAngleDeg, quality: 24 });

  const entities: string[] = [
    dxfCircle(0, 0, r_wall, 'CUT'),
    dxfPolyline(ringGeo.outline, 'CUT'),
    dxfPolyline(sunGeo.outline, 'CUT'),
    ...centerLines(0, 0),
  ];

  for (let i = 0; i < planetCount; i++) {
    const θ  = (i / planetCount) * Math.PI * 2 - Math.PI / 2;
    const px = orbit_r * Math.cos(θ), py = orbit_r * Math.sin(θ);
    const phase = Math.PI / planetTeeth + (θ + Math.PI);
    const rotated = planGeo.outline.map(p => {
      const r = Math.hypot(p.x, p.y), a = Math.atan2(p.y, p.x) + phase;
      return { x: px + r * Math.cos(a), y: py + r * Math.sin(a) };
    });
    entities.push(dxfPolyline(rotated, 'CUT'), ...centerLines(px, py));
  }

  if (showPitchCircle) {
    entities.push(
      dxfCircle(0, 0, sunGeo.pitchRadius,  'CONSTRUCTION'),
      dxfCircle(0, 0, ringGeo.pitchRadius, 'CONSTRUCTION'),
    );
    for (let i = 0; i < planetCount; i++) {
      const θ = (i / planetCount) * Math.PI * 2 - Math.PI / 2;
      entities.push(dxfCircle(orbit_r * Math.cos(θ), orbit_r * Math.sin(θ), planGeo.pitchRadius, 'CONSTRUCTION'));
    }
  }
  if (showConstruction) {
    entities.push(
      dxfCircle(0, 0, sunGeo.rootRadius, 'CONSTRUCTION'),
      dxfCircle(0, 0, sunGeo.baseRadius, 'CONSTRUCTION'),
    );
  }

  return buildDxf(entities);
}

/** Ring gear only. */
export function exportRingGearDxf(params: PlanetaryParams, opts: DxfExportOptions = {}): string {
  const { showConstruction = true, showPitchCircle = true } = opts;
  const ringTeeth = planetaryRingTeeth(params);
  const ringGeo   = generateSpurGearOutline({ teeth: ringTeeth, moduleMm: params.moduleMm, pressureAngleDeg: params.pressureAngleDeg, quality: 24 });
  const r_wall    = (ringTeeth + 2.5) * params.moduleMm / 2 + 3;
  const entities: string[] = [
    dxfCircle(0, 0, r_wall, 'CUT'),
    dxfPolyline(ringGeo.outline, 'CUT'),
    ...centerLines(0, 0),
  ];
  if (showPitchCircle)  entities.push(dxfCircle(0, 0, ringGeo.pitchRadius, 'CONSTRUCTION'));
  if (showConstruction) entities.push(dxfCircle(0, 0, r_wall, 'CONSTRUCTION'));
  return buildDxf(entities);
}

/** Sun gear only — delegates to single-gear exporter. */
export function exportSunGearDxf(p: PlanetaryParams, opts: DxfExportOptions = {}): string {
  return exportSingleGearDxf({ teeth: p.sunTeeth, moduleMm: p.moduleMm, pressureAngleDeg: p.pressureAngleDeg, boreDiameterMm: Math.max(4, p.moduleMm * 2), label: `Sun-${p.sunTeeth}T` }, opts);
}

/** One planet gear — delegates to single-gear exporter. */
export function exportPlanetGearDxf(p: PlanetaryParams, opts: DxfExportOptions = {}): string {
  return exportSingleGearDxf({ teeth: p.planetTeeth, moduleMm: p.moduleMm, pressureAngleDeg: p.pressureAngleDeg, boreDiameterMm: Math.max(3, p.moduleMm * 1.5), label: `Planet-${p.planetTeeth}T` }, opts);
}
