import { create } from 'zustand';
import type {
  GearDesignState, SpurGear, ViewMode,
  FabricationMode, FabricationState2D, FabricationState3D,
  RackPinionParams, InternalGearParams, PlanetaryParams,
} from '../core/gearTypes';

const g1: SpurGear = {
  id: 'g1', name: 'Output Gear', kind: 'spur',
  teeth: 54, moduleMm: 2, pressureAngleDeg: 20,
  x: 0, y: 0, rotationDeg: 0,
  isOutput: true, boreDiameterMm: 8, thicknessMm: 10,
};

const g2: SpurGear = {
  id: 'g2', name: 'Input Gear', kind: 'spur',
  teeth: 18, moduleMm: 2, pressureAngleDeg: 20,
  x: 0, y: 0, rotationDeg: 0,
  rpm: 1500, isInput: true, boreDiameterMm: 6, thicknessMm: 10,
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

const defaultRackPinion: RackPinionParams = {
  pinionTeeth: 18, moduleMm: 2, pressureAngleDeg: 20,
  rackLengthMm: 120, thicknessMm: 10,
};

const defaultInternalGear: InternalGearParams = {
  ringTeeth: 48, pinionTeeth: 16, moduleMm: 2,
  pressureAngleDeg: 20,
  wallThicknessMm: 3, thicknessMm: 10,
};

const defaultPlanetary: PlanetaryParams = {
  sunTeeth: 18, planetTeeth: 9, planetCount: 3,
  moduleMm: 2, pressureAngleDeg: 20, thicknessMm: 10,
};

const defaultFab2d: FabricationState2D = {
  showOutline: true,
  showCenters: true,
  showLabels: false,
  showPitchCircles: false,
  kerfOffsetMm: 0,
};

const defaultFab3d: FabricationState3D = {
  faceWidthMm: 10,
  boreDiameterMm: 8,
  hubEnabled: false,
  hubDiameterMm: 14,
  hubHeightMm: 4,
  exportFormat: 'stl',
};

interface GearStore extends GearDesignState {
  setTeeth: (id: string, teeth: number) => void;
  setModule: (moduleMm: number) => void;
  setInputRpm: (rpm: number) => void;
  setPressureAngle: (deg: number) => void;
  setThickness: (mm: number) => void;
  setViewMode: (mode: ViewMode) => void;
  setUnitSystem: (system: GearDesignState['unitSystem']) => void;
  setActiveMode: (mode: GearDesignState['activeMode']) => void;
  loadState: (state: GearDesignState) => void;
  // Rack & Pinion state
  rackPinion: RackPinionParams;
  setRackPinion: (u: Partial<RackPinionParams>) => void;
  // Internal Gear state
  internalGear: InternalGearParams;
  setInternalGear: (u: Partial<InternalGearParams>) => void;
  // Planetary state
  planetary: PlanetaryParams;
  setPlanetary: (u: Partial<PlanetaryParams>) => void;
  // Fabrication state
  fabricationMode: FabricationMode;
  fab2d: FabricationState2D;
  fab3d: FabricationState3D;
  setFabricationMode: (m: FabricationMode) => void;
  setFab2d: (updates: Partial<FabricationState2D>) => void;
  setFab3d: (updates: Partial<FabricationState3D>) => void;
}

export const useGearStore = create<GearStore>()((set) => ({
  ...initialState,
  rackPinion: defaultRackPinion,
  internalGear: defaultInternalGear,
  planetary: defaultPlanetary,
  fabricationMode: '2d-laser',
  fab2d: defaultFab2d,
  fab3d: defaultFab3d,

  setTeeth: (id, teeth) =>
    set((s) => ({ gears: s.gears.map((g) => (g.id === id ? { ...g, teeth } : g)) })),
  setModule: (moduleMm) =>
    set((s) => ({ gears: s.gears.map((g) => ({ ...g, moduleMm })) })),
  setInputRpm: (rpm) =>
    set((s) => ({ gears: s.gears.map((g) => (g.isInput ? { ...g, rpm } : g)) })),
  setPressureAngle: (pressureAngleDeg) =>
    set((s) => ({ gears: s.gears.map((g) => ({ ...g, pressureAngleDeg })) })),
  setThickness: (thicknessMm) =>
    set((s) => ({ gears: s.gears.map((g) => ({ ...g, thicknessMm })) })),
  setViewMode: (mode) =>
    set((s) => ({ view: { ...s.view, mode } })),
  setUnitSystem: (unitSystem) => set({ unitSystem }),
  setActiveMode: (activeMode) => set({ activeMode }),
  loadState: (state) => set(state),

  setRackPinion: (u) => set((s) => ({ rackPinion: { ...s.rackPinion, ...u } })),
  setInternalGear: (u) => set((s) => ({ internalGear: { ...s.internalGear, ...u } })),
  setPlanetary: (u) => set((s) => ({ planetary: { ...s.planetary, ...u } })),
  setFabricationMode: (fabricationMode) => set({ fabricationMode }),
  setFab2d: (updates) => set((s) => ({ fab2d: { ...s.fab2d, ...updates } })),
  setFab3d: (updates) => set((s) => ({ fab3d: { ...s.fab3d, ...updates } })),
}));
