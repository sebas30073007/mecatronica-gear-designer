/**
 * DXF R12 (AC1009) ASCII export — 1:1 scale (1 unit = 1 mm, Y axis up).
 * Layers: CUT (gear outline), BORE (bore circle), CONSTRUCTION (pitch/root/base + center mark).
 */

import { generateSpurGearOutline } from '../geometry/spurGear2D';
import type { GearExportParams } from './svgExport';

export interface DxfExportOptions {
  showConstruction?: boolean;
  showPitchCircle?: boolean;
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
    dxfCircle(0, 0, params.boreDiameterMm / 2, 'BORE'),
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
    dxfCircle(0, 0, gear1.boreDiameterMm / 2, 'BORE'),
    dxfCircle(cx2, cy2, gear2.boreDiameterMm / 2, 'BORE'),
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
