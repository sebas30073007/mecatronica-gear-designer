import { rootDiameter } from './gearMath';

export interface ValidationWarning {
  code: string;
  message: string;
  severity: 'warn' | 'error';
}

export function validateTeeth(teeth: number): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  if (teeth < 8) {
    warnings.push({ code: 'TEETH_TOO_FEW', message: `Mínimo recomendado: 8 dientes (actual: ${teeth})`, severity: 'error' });
  }
  if (teeth > 200) {
    warnings.push({ code: 'TEETH_LARGE', message: `Número de dientes muy alto (${teeth}). Verificar diseño.`, severity: 'warn' });
  }
  return warnings;
}

export function validateSpurGear(teeth: number, moduleMm: number): ValidationWarning[] {
  const warnings: ValidationWarning[] = [...validateTeeth(teeth)];
  const rd = rootDiameter(moduleMm, teeth);
  if (rd <= 0) {
    warnings.push({ code: 'ROOT_NEGATIVE', message: `Diámetro de raíz negativo (${rd.toFixed(2)} mm). Aumentar dientes o módulo.`, severity: 'error' });
  }
  return warnings;
}

export function validateGearPair(teeth1: number, teeth2: number, moduleMm: number): ValidationWarning[] {
  return [
    ...validateSpurGear(teeth1, moduleMm),
    ...validateSpurGear(teeth2, moduleMm),
  ];
}
