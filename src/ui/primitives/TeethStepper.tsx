import { useState, useEffect } from 'react';

interface Props {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}

export default function TeethStepper({ label, value, onChange, min = 8, max = 200 }: Props) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const [raw, setRaw] = useState(String(value));

  // Sync displayed value when parent updates (e.g., +/- buttons, mode change)
  useEffect(() => { setRaw(String(value)); }, [value]);

  const commit = () => {
    const v = parseInt(raw, 10);
    if (isNaN(v)) { setRaw(String(value)); return; }
    const clamped = clamp(v);
    setRaw(String(clamped));
    onChange(clamped);
  };

  return (
    <div>
      <div className="mini-label">{label}</div>
      <div className="stepper">
        <button onClick={() => onChange(clamp(value - 1))}>−</button>
        <input
          type="number" value={raw}
          onChange={e => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur(); } }}
        />
        <button onClick={() => onChange(clamp(value + 1))}>+</button>
      </div>
    </div>
  );
}
