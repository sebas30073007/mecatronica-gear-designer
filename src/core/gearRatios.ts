export interface GearStage {
  teethDriver: number;
  teethDriven: number;
}

export function gearRatio(teethDriver: number, teethDriven: number): number {
  return teethDriven / teethDriver;
}

export function outputRpm(inputRpm: number, teethDriver: number, teethDriven: number): number {
  return -inputRpm * (teethDriver / teethDriven);
}

export function rotationDirection(meshType: 'external' | 'internal'): 1 | -1 {
  return meshType === 'external' ? -1 : 1;
}

export function compoundTrainRatio(stages: GearStage[]): number {
  return stages.reduce((acc, stage) => acc * gearRatio(stage.teethDriver, stage.teethDriven), 1);
}
