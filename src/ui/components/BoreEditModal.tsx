import { useState, useEffect, useRef } from 'react';
import type { SpurGear, BoreType } from '../../core/gearTypes';
import { BoreIcon } from './BoreTypeSelector';

export interface BoreApplyPayload {
  type:   BoreType;
  diamMm: number;
}

interface Props {
  g1: SpurGear;
  g2: SpurGear;
  onApply: (b1: BoreApplyPayload, b2: BoreApplyPayload) => void;
  onClose: () => void;
}

// Inverted order: Keyway → D-Shaft → Round → None
const BORE_OPTS: { value: BoreType; label: string }[] = [
  { value: 'keyway',  label: 'Keyway'  },
  { value: 'd-shaft', label: 'D-Shaft' },
  { value: 'round',   label: 'Round'   },
  { value: 'none',    label: 'None'    },
];

function BoreForm({ label, boreType, boreDiam, onTypeChange, onDiamChange }: {
  label?: string;
  boreType: BoreType; boreDiam: number;
  onTypeChange: (t: BoreType) => void;
  onDiamChange: (d: number) => void;
}) {
  const [rawDiam, setRawDiam] = useState(String(boreDiam));
  useEffect(() => { setRawDiam(String(boreDiam)); }, [boreDiam]);
  const commitDiam = () => {
    const v = parseFloat(rawDiam);
    if (isNaN(v)) { setRawDiam(String(boreDiam)); return; }
    const c = Math.max(2, Math.min(50, v)); setRawDiam(String(c)); onDiamChange(c);
  };

  return (
    <div className="export-setting-group">
      {label && <div className="bore-sub-label">{label}</div>}
      <div className="export-setting-label">Type</div>

      <div className="bore-type-grid">
        {BORE_OPTS.map(o => (
          <button key={o.value}
            className={`bore-type-opt${boreType === o.value ? ' active' : ''}${o.value === 'none' ? ' bore-type-opt-none' : ''}`}
            onClick={() => onTypeChange(o.value)}>
            <BoreIcon type={o.value} size={28} />
            <span className="bore-type-opt-label">{o.label}</span>
          </button>
        ))}
      </div>

      {boreType !== 'none' && <>
        <div className="export-setting-label">Diameter</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="number" className="rbn-number"
            min={2} max={50} step={0.5} value={rawDiam}
            onChange={e => setRawDiam(e.target.value)}
            onBlur={commitDiam}
            onKeyDown={e => { if (e.key === 'Enter') { commitDiam(); (e.target as HTMLInputElement).blur(); } }}
          />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>mm</span>
        </div>
      </>}
    </div>
  );
}

function BorePreview({ type, label }: { type: BoreType; label: string }) {
  return (
    <div className="bore-preview-item">
      <BoreIcon type={type} size={72} />
      <span className="bore-preview-label">{label}</span>
    </div>
  );
}

export default function BoreEditModal({ g1, g2, onApply, onClose }: Props) {
  const [sameForBoth, setSameForBoth] = useState(true);
  const [t1, setT1] = useState<BoreType>(g1.boreType);
  const [d1, setD1] = useState(g1.boreDiameterMm ?? 8);
  const [t2, setT2] = useState<BoreType>(g2.boreType);
  const [d2, setD2] = useState(g2.boreDiameterMm ?? 6);

  const changeT1 = (t: BoreType) => { setT1(t); if (sameForBoth) setT2(t); };
  const changeD1 = (d: number)   => { setD1(d); if (sameForBoth) setD2(d); };

  const toggleSame = (val: boolean) => {
    setSameForBoth(val);
    if (val) { setT2(t1); setD2(d1); }
  };

  const handleApply = () => {
    onApply(
      { type: t1, diamMm: d1 },
      sameForBoth ? { type: t1, diamMm: d1 } : { type: t2, diamMm: d2 },
    );
    onClose();
  };

  const backdropRef = useRef<HTMLDivElement>(null);
  const onBdClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  return (
    <div className="modal-backdrop" ref={backdropRef} onClick={onBdClick}>
      <div className="export-modal bore-modal" role="dialog" aria-label="Bore settings">

        <div className="export-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="export-modal-title">Bore Settings</span>
            <span className="export-mode-badge">Simple Gear Train</span>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2.5} strokeLinecap="round">
              <line x1="18" y1="6"  x2="6"  y2="18"/>
              <line x1="6"  y1="6"  x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="export-modal-body">

          {/* Left — preview */}
          <div className="export-modal-preview">
            <div className="export-preview-label">Bore cross-section · current</div>
            <div className="bore-preview-area">
              {sameForBoth ? (
                <BorePreview type={t1} label="Both Gears" />
              ) : (
                <>
                  <BorePreview type={t1} label={`Output · ${g1.teeth}T`} />
                  <div className="bore-preview-divider" />
                  <BorePreview type={t2} label={`Input · ${g2.teeth}T`} />
                </>
              )}
            </div>
          </div>

          {/* Right — settings */}
          <div className="export-modal-settings">
            {sameForBoth ? (
              <BoreForm
                boreType={t1} boreDiam={d1}
                onTypeChange={changeT1} onDiamChange={changeD1}
              />
            ) : (
              <>
                <BoreForm label={`Output — ${g1.teeth}T`}
                  boreType={t1} boreDiam={d1}
                  onTypeChange={changeT1} onDiamChange={changeD1}
                />
                <BoreForm label={`Input — ${g2.teeth}T`}
                  boreType={t2} boreDiam={d2}
                  onTypeChange={setT2} onDiamChange={setD2}
                />
              </>
            )}

            <div className="bore-same-row" onClick={() => toggleSame(!sameForBoth)}>
              <div className={`bore-toggle-track${sameForBoth ? ' on' : ''}`}>
                <div className="bore-toggle-thumb" />
              </div>
              <span className="bore-same-label">Same for both gears</span>
            </div>

            <div className="bore-actions">
              <button className="bore-btn-reset" onClick={onClose}>Reset</button>
              <button className="export-modal-btn bore-btn-apply" onClick={handleApply}>
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
