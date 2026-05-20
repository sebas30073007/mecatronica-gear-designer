import { useState, useEffect, useRef } from 'react';
import type { SpurGear } from '../../core/gearTypes';
import { exportSingleGearSvg, exportGearPairSvg } from '../../exporters/svgExport';
import { exportSingleGearDxf, exportGearPairDxf } from '../../exporters/dxfExport';
import { downloadSvg, downloadDxf } from '../../exporters/download';

type Target = 'output' | 'input' | 'pair';
type Format = 'svg' | 'dxf';

interface Props {
  g1: SpurGear;
  g2: SpurGear;
  moduleMm: number;
  pa: number;
  onClose: () => void;
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="fab-check">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

const KERF_OPTS = [{ label: 'Off', v: 0 }, { label: '0.10', v: 0.10 }, { label: '0.15', v: 0.15 }];

export default function ExportModal({ g1, g2, moduleMm, pa, onClose }: Props) {
  const [target,     setTarget]     = useState<Target>('pair');
  const [format,     setFormat]     = useState<Format>('svg');
  const [centers,    setCenters]    = useState(true);
  const [pitch,      setPitch]      = useState(false);
  const [labels,     setLabels]     = useState(false);
  const [kerf,       setKerf]       = useState(0);
  const [previewUrl, setPreviewUrl] = useState('');

  const p1 = { teeth: g1.teeth, moduleMm, pressureAngleDeg: pa, boreDiameterMm: g1.boreDiameterMm, label: 'Output-Gear' };
  const p2 = { teeth: g2.teeth, moduleMm, pressureAngleDeg: pa, boreDiameterMm: g2.boreDiameterMm, label: 'Input-Gear' };
  // showOutline always true (gear outline is always in export); showLabels not yet implemented in exporter
  const opts = { showPitchCircle: pitch, showConstruction: centers, kerfOffsetMm: kerf };

  useEffect(() => {
    const svgStr =
      target === 'pair'   ? exportGearPairSvg(p1, p2, opts) :
      target === 'output' ? exportSingleGearSvg(p1, opts) :
                            exportSingleGearSvg(p2, opts);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, centers, pitch, kerf, g1.teeth, g2.teeth, moduleMm, pa]);

  const handleExport = () => {
    const m = moduleMm;
    if (format === 'svg') {
      if (target === 'output') downloadSvg(exportSingleGearSvg(p1, opts), `gear-output-${g1.teeth}T-M${m}.svg`);
      if (target === 'input')  downloadSvg(exportSingleGearSvg(p2, opts), `gear-input-${g2.teeth}T-M${m}.svg`);
      if (target === 'pair')   downloadSvg(exportGearPairSvg(p1, p2, opts), `gear-pair-${g1.teeth}T-${g2.teeth}T-M${m}.svg`);
    } else {
      if (target === 'output') downloadDxf(exportSingleGearDxf(p1, opts), `gear-output-${g1.teeth}T-M${m}.dxf`);
      if (target === 'input')  downloadDxf(exportSingleGearDxf(p2, opts), `gear-input-${g2.teeth}T-M${m}.dxf`);
      if (target === 'pair')   downloadDxf(exportGearPairDxf(p1, p2, opts), `gear-pair-${g1.teeth}T-${g2.teeth}T-M${m}.dxf`);
    }
  };

  const backdropRef = useRef<HTMLDivElement>(null);
  const onBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  return (
    <div className="modal-backdrop" ref={backdropRef} onClick={onBackdropClick}>
      <div className="export-modal" role="dialog" aria-label="Export gear">

        <div className="export-modal-header">
          <span className="export-modal-title">Export</span>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="export-modal-body">
          {/* Left — live SVG preview */}
          <div className="export-modal-preview">
            {previewUrl
              ? <img src={previewUrl} alt="Gear preview" className="export-preview-img" />
              : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Generating…</span>
            }
          </div>

          {/* Right — settings */}
          <div className="export-modal-settings">

            <div className="export-setting-group">
              <div className="export-setting-label">Format</div>
              <div className="segmented cols-2">
                <button className={format === 'svg' ? 'active' : ''} onClick={() => setFormat('svg')}>SVG</button>
                <button className={format === 'dxf' ? 'active' : ''} onClick={() => setFormat('dxf')}>DXF R12</button>
              </div>
            </div>

            <div className="export-setting-group">
              <div className="export-setting-label">Gear</div>
              <div className="segmented cols-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <button className={target === 'output' ? 'active' : ''} onClick={() => setTarget('output')}>
                  Output
                </button>
                <button className={target === 'input'  ? 'active' : ''} onClick={() => setTarget('input')}>
                  Input
                </button>
                <button className={target === 'pair'   ? 'active' : ''} onClick={() => setTarget('pair')}>
                  Both
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, fontFamily: 'var(--font-mono)' }}>
                {target === 'output' ? `Output — ${g1.teeth}T` :
                 target === 'input'  ? `Input — ${g2.teeth}T` :
                                       `Pair — ${g1.teeth}T + ${g2.teeth}T`}
              </div>
            </div>

            <div className="export-setting-group">
              <div className="export-setting-label">Include</div>
              <div className="fab-check-list">
                <CheckRow label="Gear outline"  checked={true}    onChange={() => {}} />
                <CheckRow label="Center marks"  checked={centers} onChange={setCenters} />
                <CheckRow label="Pitch circles" checked={pitch}   onChange={setPitch}   />
                <CheckRow label="Labels"        checked={labels}  onChange={setLabels}  />
              </div>
            </div>

            <div className="export-setting-group">
              <div className="export-setting-label">Kerf Compensation</div>
              <div className="segmented cols-3">
                {KERF_OPTS.map(k => (
                  <button key={k.v} className={kerf === k.v ? 'active' : ''} onClick={() => setKerf(k.v)}>
                    {k.label}
                  </button>
                ))}
              </div>
              {kerf > 0 && (
                <p className="fab-hint">−{kerf} mm outline, +{kerf} mm bore</p>
              )}
            </div>

            <button className="export-modal-btn" onClick={handleExport}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}>
                <path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>
              </svg>
              Export {format.toUpperCase()}
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}
