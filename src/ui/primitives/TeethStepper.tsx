interface Props { label: string; value: number; onChange: (v: number) => void; }

const clamp = (n: number) => Math.max(8, Math.min(200, n));

export default function TeethStepper({ label, value, onChange }: Props) {
  return (
    <div>
      <div className="stepper">
        <button onClick={() => onChange(clamp(value - 1))}>−</button>
        <input
          type="number" value={value} min={8} max={200}
          onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) onChange(clamp(v)); }}
        />
        <button onClick={() => onChange(clamp(value + 1))}>+</button>
      </div>
      <div className="mini-label">{label}</div>
    </div>
  );
}
