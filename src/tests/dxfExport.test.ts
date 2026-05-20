import { describe, it, expect } from 'vitest';
import { exportSingleGearDxf, exportGearPairDxf } from '../exporters/dxfExport';

const BASE = { moduleMm: 2, pressureAngleDeg: 20, boreDiameterMm: 8 };

describe('exportSingleGearDxf', () => {
  it('produces AC1009 R12 header', () => {
    const dxf = exportSingleGearDxf({ ...BASE, teeth: 54 });
    expect(dxf).toContain('AC1009');
  });

  it('declares CUT, BORE, CONSTRUCTION layers', () => {
    const dxf = exportSingleGearDxf({ ...BASE, teeth: 54 });
    expect(dxf).toContain('\nCUT\n');
    expect(dxf).toContain('\nBORE\n');
    expect(dxf).toContain('\nCONSTRUCTION\n');
  });

  it('ends with EOF marker', () => {
    const dxf = exportSingleGearDxf({ ...BASE, teeth: 54 });
    expect(dxf.trimEnd()).toMatch(/\bEOF\s*$/);
  });

  it('pitch diameter circle is 108mm for 54T M2 (LibreCAD reference)', () => {
    const dxf = exportSingleGearDxf({ ...BASE, teeth: 54 });
    // pitch radius = 54 * 2 / 2 = 54.0000, so diameter = 108mm
    expect(dxf).toContain('40\n54.0000');
  });

  it('bore circle radius matches boreDiameterMm / 2', () => {
    const dxf = exportSingleGearDxf({ ...BASE, teeth: 54 });
    // bore radius = 8/2 = 4mm, on BORE layer
    const boreIdx = dxf.indexOf('BORE\n10\n0');
    expect(boreIdx).toBeGreaterThan(-1);
    const radiusBlock = dxf.slice(boreIdx, boreIdx + 200);
    expect(radiusBlock).toContain('40\n4.0000');
  });

  it('includes gear outline polyline on CUT layer', () => {
    const dxf = exportSingleGearDxf({ ...BASE, teeth: 20 });
    expect(dxf).toContain('POLYLINE');
    expect(dxf).toContain('VERTEX');
    expect(dxf).toContain('SEQEND');
  });

  it('includes construction circles when enabled', () => {
    const dxf = exportSingleGearDxf({ ...BASE, teeth: 20 }, { showConstruction: true });
    // root and base circles on CONSTRUCTION layer
    const constructionCount = (dxf.match(/\nCONSTRUCTION\n/g) ?? []).length;
    expect(constructionCount).toBeGreaterThan(3);
  });

  it('omits construction circles when disabled', () => {
    const withOut = exportSingleGearDxf({ ...BASE, teeth: 20 }, { showConstruction: false, showPitchCircle: false });
    // only center mark lines on CONSTRUCTION
    const circleCount = (withOut.match(/\nCIRCLE\n/g) ?? []).length;
    expect(circleCount).toBe(1); // bore only
  });

  it('includes mandatory empty BLOCKS section before ENTITIES', () => {
    const dxf = exportSingleGearDxf({ ...BASE, teeth: 20 });
    const blocksIdx   = dxf.indexOf('SECTION\n2\nBLOCKS');
    const entitiesIdx = dxf.indexOf('SECTION\n2\nENTITIES');
    expect(blocksIdx).toBeGreaterThan(-1);
    expect(entitiesIdx).toBeGreaterThan(blocksIdx);
  });

  it('declares default layer "0" in TABLES', () => {
    const dxf = exportSingleGearDxf({ ...BASE, teeth: 20 });
    const tablesStart = dxf.indexOf('SECTION\n2\nTABLES');
    const tablesEnd   = dxf.indexOf('ENDTAB');
    const tables = dxf.slice(tablesStart, tablesEnd);
    expect(tables).toContain('\nLAYER\n2\n0\n');
  });

  it('POLYLINE header has dummy 10/20/30 position before flags', () => {
    const dxf = exportSingleGearDxf({ ...BASE, teeth: 20 });
    // R12 requires 10/20/30=0 on POLYLINE entity before 66/70 flags
    expect(dxf).toContain('POLYLINE\n8\nCUT\n10\n0.0000\n20\n0.0000\n30\n0.0000\n66\n1\n70\n1\n');
  });
});

describe('exportGearPairDxf', () => {
  const g1 = { ...BASE, teeth: 54 };
  const g2 = { ...BASE, teeth: 18 };

  it('produces valid DXF with EOF', () => {
    const dxf = exportGearPairDxf(g1, g2);
    expect(dxf).toContain('AC1009');
    expect(dxf.trimEnd()).toMatch(/\bEOF\s*$/);
  });

  it('contains two POLYLINE entities (both gear outlines)', () => {
    const dxf = exportGearPairDxf(g1, g2);
    const count = (dxf.match(/\nPOLYLINE\n/g) ?? []).length;
    expect(count).toBe(2);
  });

  it('contains two BORE circles', () => {
    const dxf = exportGearPairDxf(g1, g2);
    const boreCount = (dxf.match(/\nBORE\n/g) ?? []).length;
    // 2 bore circles (one per gear)
    expect(boreCount).toBeGreaterThanOrEqual(2);
  });

  it('axis line between centers is on CONSTRUCTION layer', () => {
    const dxf = exportGearPairDxf(g1, g2, { showPitchCircle: true });
    expect(dxf).toContain('LINE');
    const constructionLines = (dxf.match(/\nLINE[\s\S]*?CONSTRUCTION/g) ?? []).length;
    expect(constructionLines).toBeGreaterThan(0);
  });

  it('center distance for 54T+18T M2 is 72mm (pitch r1=54 + pitch r2=18)', () => {
    const dxf = exportGearPairDxf(g1, g2);
    // gear2 offset = (54+18) = 72mm center distance
    // cx2 = 72 * cos(215°) ≈ -58.98, cy2 = 72 * sin(215°) ≈ -41.30
    // The CIRCLE for gear2's bore is at (cx2, cy2)
    const angle = 215 * (Math.PI / 180);
    const cd = 72;
    const cx2 = (cd * Math.cos(angle)).toFixed(4);
    expect(dxf).toContain(`10\n${cx2}`);
  });
});
