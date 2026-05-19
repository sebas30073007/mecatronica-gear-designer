import { create } from 'zustand';
import type { GearDesignState, SpurGear, ViewMode } from '../core/gearTypes';

const g1: SpurGear = {
  id: 'g1',
  name: 'Output Gear',
  kind: 'spur',
  teeth: 54,
  moduleMm: 2,
  pressureAngleDeg: 20,
  x: 390,
  y: 180,
  rotationDeg: 0,
  isOutput: true,
  boreDiameterMm: 8,
  thicknessMm: 10,
};

const g2: SpurGear = {
  id: 'g2',
  name: 'Input Gear',
  kind: 'spur',
  teeth: 18,
  moduleMm: 2,
  pressureAngleDeg: 20,
  x: 225,
  y: 300,
  rotationDeg: 0,
  rpm: 1500,
  isInput: true,
  boreDiameterMm: 6,
  thicknessMm: 10,
};

export const initialState: GearDesignState = {
  schemaVersion: 1,
  projectName: 'Reductora-01',
  unitSystem: 'metric',
  activeMode: 'simple',
  gears: [g1, g2],
  planetarySets: [],
  selectedId: undefined,
  view: { zoom: 1, panX: 0, panY: 0, showGrid: true, mode: '2d' },
};

interface GearStore extends GearDesignState {
  setTeeth: (id: string, teeth: number) => void;
  setModule: (moduleMm: number) => void;
  setInputRpm: (rpm: number) => void;
  setPressureAngle: (deg: number) => void;
  setViewMode: (mode: ViewMode) => void;
  setUnitSystem: (system: GearDesignState['unitSystem']) => void;
  setActiveMode: (mode: GearDesignState['activeMode']) => void;
  loadState: (state: GearDesignState) => void;
}

export const useGearStore = create<GearStore>()((set) => ({
  ...initialState,

  setTeeth: (id, teeth) =>
    set((s) => ({
      gears: s.gears.map((g) => (g.id === id ? { ...g, teeth } : g)),
    })),

  setModule: (moduleMm) =>
    set((s) => ({
      gears: s.gears.map((g) => ({ ...g, moduleMm })),
    })),

  setInputRpm: (rpm) =>
    set((s) => ({
      gears: s.gears.map((g) => (g.isInput ? { ...g, rpm } : g)),
    })),

  setPressureAngle: (pressureAngleDeg) =>
    set((s) => ({
      gears: s.gears.map((g) => ({ ...g, pressureAngleDeg })),
    })),

  setViewMode: (mode) =>
    set((s) => ({ view: { ...s.view, mode } })),

  setUnitSystem: (unitSystem) => set({ unitSystem }),

  setActiveMode: (activeMode) => set({ activeMode }),

  loadState: (state) => set(state),
}));
