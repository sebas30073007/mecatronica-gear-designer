interface Props {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}

export default function TeethStepper({ label, value, onChange, min = 8, max = 200 }: Props) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div>
      <div className="stepper">
        <button onClick={() => onChange(clamp(value - 1))}>−</button>
        <input
          type="number" value={value} min={min} max={max}
          onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) onChange(clamp(v)); }}
        />
        <button onClick={() => onChange(clamp(value + 1))}>+</button>
      </div>
      <div className="mini-label">{label}</div>
    </div>
  );
}
