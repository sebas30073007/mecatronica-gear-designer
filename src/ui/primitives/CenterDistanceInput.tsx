import { useState } from 'react';
import type { UnitSystem } from '../../core/gearTypes';
import { fmtLength, MM_PER_INCH } from '../../core/units';
import { teethForCenterDistance } from '../../core/gearMath';

interface Props {
  valueMm: number;
  moduleMm: number;
  ratio: number;
  unitSystem: UnitSystem;
  onTeethChange: (t1: number, t2: number) => void;
}

export default function CenterDistanceInput({ valueMm, moduleMm, ratio, unitSystem, onTeethChange }: Props) {
  const [focused, setFocused] = useState(false);
  const [local, setLocal]     = useState('');

  const toDisplay = (mm: number) =>
    unitSystem === 'imperial' ? (mm / MM_PER_INCH).toFixed(4) : mm.toFixed(2);

  const tryApply = (raw: string) => {
    const v = parseFloat(raw);
    if (isNaN(v) || v <= 0) return;
    const targetMm = unitSystem === 'imperial' ? v * MM_PER_INCH : v;
    const { teeth1, teeth2 } = teethForCenterDistance(targetMm, moduleMm, ratio);
    onTeethChange(teeth1, teeth2);
  };

  return (
    <input
      className="text-input"
      type="text"
      inputMode="decimal"
      style={{ textAlign: 'right' }}
      value={focused ? local : fmtLength(valueMm, unitSystem)}
      onFocus={e => { setFocused(true); setLocal(toDisplay(valueMm)); e.target.select(); }}
      onChange={e => { setLocal(e.target.value); tryApply(e.target.value); }}
      onBlur={() => { tryApply(local); setFocused(false); }}
      onKeyDown={e => { if (e.key === 'Enter') { tryApply(local); (e.target as HTMLInputElement).blur(); } }}
    />
  );
}
