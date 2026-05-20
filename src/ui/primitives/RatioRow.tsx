import { useState } from 'react';

interface Props { ratio: number; teethIn: number; onTeethOutChange: (t: number) => void; }

export default function RatioRow({ ratio, teethIn, onTeethOutChange }: Props) {
  const [focused, setFocused] = useState(false);
  const [local, setLocal]     = useState('');

  const tryApply = (raw: string) => {
    const r = parseFloat(raw);
    if (!isNaN(r) && r > 0 && r <= 50)
      onTeethOutChange(Math.max(8, Math.min(200, Math.round(r * teethIn))));
  };

  return (
    <>
      <div className="ratio-row">
        <input className="input-pill" type="number" step="0.1" min="0.1" max="50"
          value={focused ? local : ratio.toFixed(2)}
          onFocus={() => { setFocused(true); setLocal(ratio.toFixed(2)); }}
          onChange={e => { setLocal(e.target.value); tryApply(e.target.value); }}
          onBlur={() => { tryApply(local); setFocused(false); }}
          onKeyDown={e => { if (e.key === 'Enter') { tryApply(local); (e.target as HTMLInputElement).blur(); } }}
        />
        <span className="colon">:</span>
        <input className="input-pill" type="number" value={1} readOnly
          style={{ color: 'var(--text-muted)', cursor: 'default' }} />
      </div>
      <div className="ratio-row">
        <div className="mini-label">Output</div>
        <div />
        <div className="mini-label">Input</div>
      </div>
    </>
  );
}
