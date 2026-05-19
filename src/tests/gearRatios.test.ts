import { describe, it, expect } from 'vitest';
import { gearRatio, outputRpm, rotationDirection, compoundTrainRatio } from '../core/gearRatios';

describe('gearRatio', () => {
  it('18→54 = 3:1', () => {
    expect(gearRatio(18, 54)).toBeCloseTo(3.0, 5);
  });
  it('1:1 con mismos dientes', () => {
    expect(gearRatio(20, 20)).toBe(1);
  });
  it('overdrive 54→18 = 0.333', () => {
    expect(gearRatio(54, 18)).toBeCloseTo(1 / 3, 5);
  });
});

describe('outputRpm', () => {
  it('1500 rpm, 18→54 → -500 rpm (inversión)', () => {
    expect(outputRpm(1500, 18, 54)).toBeCloseTo(-500, 2);
  });
  it('1000 rpm, 1:1 → -1000 rpm', () => {
    expect(outputRpm(1000, 20, 20)).toBe(-1000);
  });
  it('negativo input, 18→54 → positivo output', () => {
    expect(outputRpm(-1500, 18, 54)).toBeCloseTo(500, 2);
  });
});

describe('rotationDirection', () => {
  it('engrane externo invierte dirección', () => {
    expect(rotationDirection('external')).toBe(-1);
  });
  it('engrane interno mantiene dirección', () => {
    expect(rotationDirection('internal')).toBe(1);
  });
});

describe('compoundTrainRatio', () => {
  it('dos etapas 18→54 = 9:1', () => {
    const stages = [
      { teethDriver: 18, teethDriven: 54 },
      { teethDriver: 18, teethDriven: 54 },
    ];
    expect(compoundTrainRatio(stages)).toBeCloseTo(9, 5);
  });
  it('etapa única = gearRatio simple', () => {
    expect(compoundTrainRatio([{ teethDriver: 18, teethDriven: 54 }])).toBeCloseTo(3, 5);
  });
  it('sin etapas = ratio 1', () => {
    expect(compoundTrainRatio([])).toBe(1);
  });
  it('tres etapas 2:1 = 8:1', () => {
    const stages = Array(3).fill({ teethDriver: 10, teethDriven: 20 });
    expect(compoundTrainRatio(stages)).toBeCloseTo(8, 5);
  });
});
