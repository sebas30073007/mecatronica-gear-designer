import { describe, it, expect } from 'vitest';
import { exportSingleGearSvg, exportGearPairSvg } from '../exporters/svgExport';

describe('exportSingleGearSvg', () => {
  const base = { teeth: 54, moduleMm: 2, pressureAngleDeg: 20, boreDiameterMm: 8 };

  it('produces valid SVG markup', () => {
    const svg = exportSingleGearSvg(base);
    expect(svg).toContain('<?xml version="1.0"');
    expect(svg).toContain('<svg ');
    expect(svg).toContain('</svg>');
  });

  it('uses 1:1 scale — width is 2*(outerRadius+margin) mm (critical)', () => {
    // 54T M2: outerRadius = 56mm, default margin = 6mm → size = 124mm
    const svg = exportSingleGearSvg(base);
    expect(svg).toContain('width="124.000mm"');
    expect(svg).toContain('height="124.000mm"');
  });

  it('pitch diameter in metadata is exactly 108mm for 54T M2 (reference check)', () => {
    const svg = exportSingleGearSvg(base);
    expect(svg).toContain('Pitch Ø: 108.000 mm');
  });

  it('outer diameter in metadata is 112mm for 54T M2', () => {
    const svg = exportSingleGearSvg(base);
    expect(svg).toContain('Outer Ø: 112.000 mm');
  });

  it('includes gear outline and bore paths', () => {
    const svg = exportSingleGearSvg(base);
    expect(svg).toContain('id="gear-outline"');
    expect(svg).toContain('id="bore"');
  });

  it('includes pitch circle layer by default', () => {
    const svg = exportSingleGearSvg(base);
    expect(svg).toContain('id="layer-pitch"');
  });

  it('omits pitch circle when disabled', () => {
    const svg = exportSingleGearSvg(base, { showPitchCircle: false });
    expect(svg).not.toContain('id="layer-pitch"');
  });

  it('includes construction layer (root + base circles) by default', () => {
    const svg = exportSingleGearSvg(base);
    expect(svg).toContain('id="layer-construction"');
  });

  it('omits construction layer when disabled', () => {
    const svg = exportSingleGearSvg(base, { showConstruction: false });
    expect(svg).not.toContain('id="layer-construction"');
  });

  it('includes a center mark', () => {
    const svg = exportSingleGearSvg(base);
    expect(svg).toContain('id="center-mark"');
  });

  it('respects custom margin', () => {
    // margin=10 → size = 2*(56+10) = 132mm
    const svg = exportSingleGearSvg(base, { marginMm: 10 });
    expect(svg).toContain('width="132.000mm"');
  });

  it('small gear — 18T M2: pitch diameter 36mm in metadata', () => {
    const svg = exportSingleGearSvg({ teeth: 18, moduleMm: 2, pressureAngleDeg: 20, boreDiameterMm: 6 });
    expect(svg).toContain('Pitch Ø: 36.000 mm');
  });
});

describe('exportGearPairSvg', () => {
  const g1 = { teeth: 54, moduleMm: 2, pressureAngleDeg: 20, boreDiameterMm: 8 };
  const g2 = { teeth: 18, moduleMm: 2, pressureAngleDeg: 20, boreDiameterMm: 6 };

  it('produces valid SVG', () => {
    const svg = exportGearPairSvg(g1, g2);
    expect(svg).toContain('<svg ');
    expect(svg).toContain('</svg>');
  });

  it('center distance metadata is 72mm for 54T+18T M2 (reference check)', () => {
    const svg = exportGearPairSvg(g1, g2);
    expect(svg).toContain('Center Distance: 72.000 mm');
  });

  it('contains both gear outlines and both bores', () => {
    const svg = exportGearPairSvg(g1, g2);
    expect(svg).toContain('id="gear1-outline"');
    expect(svg).toContain('id="gear2-outline"');
    expect(svg).toContain('id="bore1"');
    expect(svg).toContain('id="bore2"');
  });

  it('contains axis line between gear centers on pitch layer', () => {
    const svg = exportGearPairSvg(g1, g2);
    expect(svg).toContain('id="layer-pitch"');
    expect(svg).toContain('stroke-dasharray="4 2"');
  });

  it('SVG dimensions are positive numbers', () => {
    const svg = exportGearPairSvg(g1, g2);
    const wMatch = svg.match(/width="([\d.]+)mm"/);
    const hMatch = svg.match(/height="([\d.]+)mm"/);
    expect(parseFloat(wMatch![1]!)).toBeGreaterThan(0);
    expect(parseFloat(hMatch![1]!)).toBeGreaterThan(0);
  });
});
