import { useState, useEffect, useRef } from 'react';
import type { SpurGear } from '../../core/gearTypes';
import { exportSingleGearSvg, exportGearPairSvg } from '../../exporters/svgExport';
import { exportSingleGearDxf, exportGearPairDxf } from '../../exporters/dxfExport';
import { exportGearStl, exportGearObj } from '../../exporters/meshExport';
import { downloadSvg, downloadDxf, downloadStl, downloadObj } from '../../exporters/download';

type Target = 'output' | 'input' | 'pair';
type Format = 'svg' | 'dxf' | 'stl' | 'obj';

interface Props {
  g1: SpurGear;
  g2: SpurGear;
  moduleMm: number;
  pa: number;
  is3d: boolean;
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
const is3dFmt  = (f: Format) => f === 'stl' || f === 'obj';

export default function ExportModal({ g1, g2, moduleMm, pa, is3d, onClose }: Props) {
  const [target,     setTarget]     = useState<Target>('pair');
  const [format,     setFormat]     = useState<Format>(is3d ? 'stl' : 'svg');
  const [centers,    setCenters]    = useState(true);
  const [pitch,      setPitch]      = useState(false);
  const [labels,     setLabels]     = useState(false);
  const [kerf,       setKerf]       = useState(0);
  const [thickness,  setThickness]  = useState(g1.thicknessMm);
  const [previewUrl, setPreviewUrl] = useState('');

  const p1 = { teeth: g1.teeth, moduleMm, pressureAngleDeg: pa, boreDiameterMm: g1.boreDiameterMm, label: 'Output-Gear' };
  const p2 = { teeth: g2.teeth, moduleMm, pressureAngleDeg: pa, boreDiameterMm: g2.boreDiameterMm, label: 'Input-Gear' };
  const opts = { showPitchCircle: pitch, showConstruction: centers, showLabels: labels, kerfOffsetMm: kerf };

  // SVG preview (shown for all formats as top-view reference)
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
  }, [target, centers, pitch, labels, kerf, g1.teeth, g2.teeth, moduleMm, pa]);

  const handleExport = () => {
    const m = moduleMm;
    const mesh1 = { ...p1, thicknessMm: thickness };
    const mesh2 = { ...p2, thicknessMm: thickness };
    const fname = (tag: string, ext: string) =>
      target === 'pair'
        ? `gear-pair-${g1.teeth}T-${g2.teeth}T-M${m}.${ext}`
        : `gear-${tag}-${target === 'output' ? g1.teeth : g2.teeth}T-M${m}.${ext}`;

    if (format === 'svg') {
      if (target === 'output') downloadSvg(exportSingleGearSvg(p1, opts), fname('output', 'svg'));
      if (target === 'input')  downloadSvg(exportSingleGearSvg(p2, opts), fname('input', 'svg'));
      if (target === 'pair')   downloadSvg(exportGearPairSvg(p1, p2, opts), fname('pair', 'svg'));
    } else if (format === 'dxf') {
      if (target === 'output') downloadDxf(exportSingleGearDxf(p1, opts), fname('output', 'dxf'));
      if (target === 'input')  downloadDxf(exportSingleGearDxf(p2, opts), fname('input', 'dxf'));
      if (target === 'pair')   downloadDxf(exportGearPairDxf(p1, p2, opts), fname('pair', 'dxf'));
    } else if (format === 'stl') {
      if (target === 'output') downloadStl(exportGearStl(mesh1, 'Output-Gear'), fname('output', 'stl'));
      if (target === 'input')  downloadStl(exportGearStl(mesh2, 'Input-Gear'),  fname('input',  'stl'));
      if (target === 'pair')   downloadStl(exportGearStl(mesh1, 'Output-Gear'), fname('output', 'stl')); // export each
    } else if (format === 'obj') {
      if (target === 'output') downloadObj(exportGearObj(mesh1, 'Output-Gear'), fname('output', 'obj'));
      if (target === 'input')  downloadObj(exportGearObj(mesh2, 'Input-Gear'),  fname('input',  'obj'));
      if (target === 'pair')   downloadObj(exportGearObj(mesh1, 'Output-Gear'), fname('output', 'obj'));
    }
  };

  const backdropRef = useRef<HTMLDivElement>(null);
  const onBdClick   = (e: React.MouseEvent) => { if (e.target === backdropRef.current) onClose(); };

  return (
    <div className="modal-backdrop" ref={backdropRef} onClick={onBdClick}>
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

          {/* Left — SVG preview (top-view reference for all formats) */}
          <div className="export-modal-preview">
            {is3dFmt(format) && (
              <div style={{ position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center',
                            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                Top view (2D reference)
              </div>
            )}
            {previewUrl
              ? <img src={previewUrl} alt="Gear preview" className="export-preview-img" />
              : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Generating…</span>
            }
          </div>

          {/* Right — settings */}
          <div className="export-modal-settings">

            {/* Format */}
            <div className="export-setting-group">
              <div className="export-setting-label">Format</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div className="segmented cols-2" style={{ fontSize: 12 }}>
                  <button className={format === 'svg' ? 'active' : ''} onClick={() => setFormat('svg')}>SVG</button>
                  <button className={format === 'dxf' ? 'active' : ''} onClick={() => setFormat('dxf')}>DXF R12</button>
                </div>
                <div className="segmented cols-2" style={{ fontSize: 12 }}>
                  <button className={format === 'stl' ? 'active' : ''} onClick={() => setFormat('stl')}>STL</button>
                  <button className={format === 'obj' ? 'active' : ''} onClick={() => setFormat('obj')}>OBJ</button>
                </div>
              </div>
              <p className="fab-hint" style={{ marginTop: 4 }}>
                {format === 'svg' ? 'Vector, 1:1 scale, layers' :
                 format === 'dxf' ? 'DXF R12 ASCII, CUT / BORE layers' :
                 format === 'stl' ? 'ASCII STL, 3D printable mesh' :
                                    'Wavefront OBJ, 3D mesh with vertices'}
              </p>
            </div>

            {/* Gear target */}
            <div className="export-setting-group">
              <div className="export-setting-label">Gear</div>
              <div className="segmented cols-3">
                <button className={target === 'output' ? 'active' : ''} onClick={() => setTarget('output')}>Output</button>
                <button className={target === 'input'  ? 'active' : ''} onClick={() => setTarget('input')}>Input</button>
                <button className={target === 'pair'   ? 'active' : ''} onClick={() => setTarget('pair')}>Both</button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, fontFamily: 'var(--font-mono)' }}>
                {target === 'output' ? `Output — ${g1.teeth}T` :
                 target === 'input'  ? `Input — ${g2.teeth}T` :
                                       `Pair — ${g1.teeth}T + ${g2.teeth}T`}
                {is3dFmt(format) && target === 'pair' ? ' (exports Output first)' : ''}
              </div>
            </div>

            {/* 2D-specific options */}
            {!is3dFmt(format) && <>
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
                {kerf > 0 && <p className="fab-hint">−{kerf} mm outline  ·  +{kerf} mm bore</p>}
              </div>
            </>}

            {/* 3D-specific options */}
            {is3dFmt(format) && (
              <div className="export-setting-group">
                <div className="export-setting-label">Face Width</div>
                <input
                  className="text-input"
                  type="number" min={2} max={100} step={1} value={thickness}
                  onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) setThickness(v); }}
                />
                <p className="fab-hint">
                  {target === 'output' || target === 'pair' ? `Output: ${g1.teeth}T  Ø${g1.teeth * moduleMm}mm` : ''}
                  {target === 'input' ? `Input: ${g2.teeth}T  Ø${g2.teeth * moduleMm}mm` : ''}
                </p>
              </div>
            )}

            {/* Export button */}
            <button className="export-modal-btn" onClick={handleExport}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round"
                   strokeLinejoin="round" strokeWidth={2.5}>
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
