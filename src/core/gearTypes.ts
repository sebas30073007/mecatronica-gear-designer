export type UnitSystem = 'metric' | 'imperial';

export type GearKind =
  | 'spur'
  | 'internal'
  | 'rackPinion'
  | 'planetary'
  | 'bevel'
  | 'helical'
  | 'worm'
  | 'herringbone';

export type GearConnection = 'mesh' | 'sameAxis' | 'fixed' | 'free';

export type ActiveMode = 'simple' | 'compound' | 'planetary' | 'library';

export type ViewMode = '2d' | '3d';

export interface BaseGear {
  id: string;
  name: string;
  kind: GearKind;
  teeth: number;
  moduleMm: number;
  pressureAngleDeg: number;
  x: number;
  y: number;
  rotationDeg: number;
  rpm?: number;
  parentId?: string;
  connection?: GearConnection;
  isInput?: boolean;
  isOutput?: boolean;
  isFixed?: boolean;
}

export interface SpurGear extends BaseGear {
  kind: 'spur';
  boreDiameterMm: number;
  thicknessMm: number;
}

export interface InternalGear extends BaseGear {
  kind: 'internal';
  outerDiameterMm?: number;
  thicknessMm: number;
}

export interface PlanetaryGearSet {
  id: string;
  kind: 'planetary';
  sunTeeth: number;
  planetTeeth: number;
  ringTeeth: number;
  planetCount: number;
  moduleMm: number;
  pressureAngleDeg: number;
  input: 'sun' | 'ring' | 'carrier';
  fixed: 'sun' | 'ring' | 'carrier';
  output: 'sun' | 'ring' | 'carrier';
  inputRpm: number;
}

export interface GearView {
  zoom: number;
  panX: number;
  panY: number;
  showGrid: boolean;
  mode: ViewMode;
}

export interface GearDesignState {
  schemaVersion: 1;
  projectName: string;
  unitSystem: UnitSystem;
  activeMode: ActiveMode;
  gears: BaseGear[];
  planetarySets: PlanetaryGearSet[];
  selectedId?: string;
  view: GearView;
}
