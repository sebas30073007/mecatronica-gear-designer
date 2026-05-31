import { useState, useEffect, useRef } from 'react';
import type {
  SpurGear, ActiveMode,
  RackPinionParams, InternalGearParams, PlanetaryParams,
} from '../../core/gearTypes';
import { planetaryRingTeeth } from '../../core/gearTypes';
import { exportSingleGearSvg, exportGearPairSvg } from '../../exporters/svgExport';
import { exportSingleGearDxf, exportGearPairDxf } from '../../exporters/dxfExport';
import { exportGearStl, exportGearObj } from '../../exporters/meshExport';
import { downloadSvg, downloadDxf, downloadStl, downloadObj } from '../../exporters/download';
import {
  exportSpurGearStep, exportRingGearStep, exportRackStep,
} from '../../exporters/stepExport';
import { KerfDetailView } from './KerfDetailView';
import StaticGearPreview from './StaticGearPreview';

type Bundle = 'separate' | 'combined';
type Format = 'svg' | 'dxf' | 'stl' | 'obj' | 'step';

const CANVAS_MODES: ActiveMode[] = [
  'simple', 'rack-pinion', 'internal', 'planetary', 'helical', 'herringbone', 'worm',
];

const MODE_LABELS: Record<ActiveMode, string> = {
  simple:        'Simple Gear Train',
  'rack-pinion': 'Rack & Pinion',
  internal:      'Internal Gear',
  planetary:     'Planetary',
  compound:      'Compound Train',
  helical:       'Helical Gear',
  bevel:         'Bevel Gear',
  herringbone:   'Herringbone',
  worm:          'Worm Gear',
};

interface Props {
  g1: SpurGear;
  g2: SpurGear;
  moduleMm: number;
  pa: number;
  is3d: boolean;
  activeMode: ActiveMode;
  rackPinion: RackPinionParams;
  internalGear: InternalGearParams;
  planetary: PlanetaryParams;
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
const isSimple2D = (mode: ActiveMode, is3d: boolean) => mode === 'simple' && !is3d;

export default function ExportModal({
  g1, g2, moduleMm, pa, is3d, activeMode,
  rackPinion, internalGear, planetary,
  onClose,
}: Props) {
  const [bundle,    setBundle]    = useState<Bundle>('separate');
  const [format,    setFormat]    = useState<Format>(is3d ? 'stl' : 'svg');
  const [centers,   setCenters]   = useState(true);
  const [pitch,     setPitch]     = useState(false);
  const [labels,    setLabels]    = useState(false);
  const [kerf,      setKerf]      = useState(0);
  const [thickness] = useState(g1.thicknessMm);
  const [svgUrl,    setSvgUrl]    = useState('');
  const [snapshotUrl, setSnapshotUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [stepError, setStepError] = useState('');

  const animatingRef = useRef(false);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const p1   = { teeth: g1.teeth, moduleMm, pressureAngleDeg: pa, boreDiameterMm: g1.boreDiameterMm, boreType: g1.boreType, label: 'Output-Gear' };
  const p2   = { teeth: g2.teeth, moduleMm, pressureAngleDeg: pa, boreDiameterMm: g2.boreDiameterMm, boreType: g2.boreType, label: 'Input-Gear' };
  const opts = { showPitchCircle: pitch, showConstruction: centers, showLabels: labels, kerfOffsetMm: kerf };

  useEffect(() => {
    return () => {
      animatingRef.current = false;
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    };
  }, []);

  // Capture 3D canvas snapshot
  useEffect(() => {
    if (!CANVAS_MODES.includes(activeMode)) return;
    const raf = requestAnimationFrame(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('.gear3d-canvas');
      if (!canvas || canvas.width === 0) return;
      try {
        const full = document.createElement('canvas');
        full.width = canvas.width; full.height = canvas.height;
        const ctx2d = full.getContext('2d')!;
        ctx2d.drawImage(canvas, 0, 0);
        const { data, width, height } = ctx2d.getImageData(0, 0, full.width, full.height);
        let x0 = width, y0 = height, x1 = 0, y1 = 0;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if ((data[i]! + data[i + 1]! + data[i + 2]!) < 600) {
              if (x < x0) x0 = x; if (x > x1) x1 = x;
              if (y < y0) y0 = y; if (y > y1) y1 = y;
            }
          }
        }
        if (x1 <= x0 || y1 <= y0) { setSnapshotUrl(canvas.toDataURL('image/png')); return; }
        const pad = Math.round(Math.min(x1 - x0, y1 - y0) * 0.12);
        x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
        x1 = Math.min(width, x1 + pad); y1 = Math.min(height, y1 + pad);
        const out = document.createElement('canvas');
        out.width = x1 - x0; out.height = y1 - y0;
        out.getContext('2d')!.drawImage(full, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
        setSnapshotUrl(out.toDataURL('image/png'));
      } catch (_) {
        try { setSnapshotUrl(canvas.toDataURL('image/png')); } catch (_2) { /* context lost */ }
      }
    });
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SVG preview for simple 2D mode
  useEffect(() => {
    if (!isSimple2D(activeMode, is3d)) return;
    const svgStr = exportGearPairSvg(p1, p2, opts);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    setSvgUrl(url);
    return () => URL.revokeObjectURL(url);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centers, pitch, labels, kerf, g1.teeth, g2.teeth, moduleMm, pa, activeMode, is3d]);

  // Smooth fill for sync formats (0 → 100% over `ms` milliseconds)
  const animateFill = (ms: number): Promise<void> => {
    animatingRef.current = true;
    return new Promise(resolve => {
      const start = performance.now();
      const step = (now: number) => {
        if (!animatingRef.current) { resolve(); return; }
        const t = Math.min(1, (now - start) / ms);
        setProgress((1 - Math.pow(1 - t, 3)) * 100);
        if (t < 1) requestAnimationFrame(step);
        else { animatingRef.current = false; resolve(); }
      };
      requestAnimationFrame(step);
    });
  };

  const handleExport = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setProgress(0);
    setStepError('');

    const m     = moduleMm;
    const mesh1 = { ...p1, thicknessMm: thickness };
    const mesh2 = { ...p2, thicknessMm: thickness };
    const f1    = (ext: string) => `gear-output-${g1.teeth}T-M${m}.${ext}`;
    const f2    = (ext: string) => `gear-input-${g2.teeth}T-M${m}.${ext}`;
    const fp    = (ext: string) => `gear-pair-${g1.teeth}T-${g2.teeth}T-M${m}.${ext}`;

    if (format === 'step') {
      // Simulated log-approach progress during API calls
      stepTimerRef.current = setInterval(() => {
        setProgress(p => p < 80 ? p + (80 - p) * 0.06 : p);
      }, 160);

      const toStepBore = (t: SpurGear['boreType']): 'd-shaft' | 'keyway' | 'round' | 'none' =>
        t === 'd-shaft' || t === 'keyway' || t === 'round' ? t : 'none';

      try {
        switch (activeMode) {
          case 'simple':
            await exportSpurGearStep({
              teeth: g1.teeth, module_mm: m, pressure_angle_deg: pa,
              thickness_mm: g1.thicknessMm, bore_mm: g1.boreDiameterMm ?? null,
              bore_type: toStepBore(g1.boreType), label: `output-${g1.teeth}T`,
            });
            if (bundle === 'separate') {
              await exportSpurGearStep({
                teeth: g2.teeth, module_mm: m, pressure_angle_deg: pa,
                thickness_mm: g2.thicknessMm, bore_mm: g2.boreDiameterMm ?? null,
                bore_type: toStepBore(g2.boreType), label: `input-${g2.teeth}T`,
              });
            }
            break;

          case 'rack-pinion': {
            const rp = rackPinion;
            await exportSpurGearStep({
              teeth: rp.pinionTeeth, module_mm: rp.moduleMm, pressure_angle_deg: rp.pressureAngleDeg,
              thickness_mm: rp.thicknessMm, bore_mm: null, bore_type: 'none',
              label: `pinion-${rp.pinionTeeth}T`,
            });
            if (bundle === 'separate') {
              const nTeeth = Math.max(3, Math.round(rp.rackLengthMm / (Math.PI * rp.moduleMm)));
              await exportRackStep({
                n_teeth: nTeeth, module_mm: rp.moduleMm, pressure_angle_deg: rp.pressureAngleDeg,
                thickness_mm: rp.thicknessMm, label: 'rack',
              });
            }
            break;
          }

          case 'internal': {
            const ig = internalGear;
            await exportSpurGearStep({
              teeth: ig.pinionTeeth, module_mm: ig.moduleMm, pressure_angle_deg: ig.pressureAngleDeg,
              thickness_mm: ig.thicknessMm, bore_mm: null, bore_type: 'none',
              label: `pinion-${ig.pinionTeeth}T`,
            });
            if (bundle === 'separate') {
              await exportRingGearStep({
                ring_teeth: ig.ringTeeth, module_mm: ig.moduleMm,
                pressure_angle_deg: ig.pressureAngleDeg,
                thickness_mm: ig.thicknessMm, wall_thickness_mm: ig.wallThicknessMm,
                label: `ring-${ig.ringTeeth}T`,
              });
            }
            break;
          }

          case 'planetary': {
            const pl = planetary;
            const ringTeeth = planetaryRingTeeth(pl);
            await exportSpurGearStep({
              teeth: pl.sunTeeth, module_mm: pl.moduleMm, pressure_angle_deg: pl.pressureAngleDeg,
              thickness_mm: pl.thicknessMm, bore_mm: null, bore_type: 'none',
              label: `sun-${pl.sunTeeth}T`,
            });
            if (bundle === 'separate') {
              await exportSpurGearStep({
                teeth: pl.planetTeeth, module_mm: pl.moduleMm, pressure_angle_deg: pl.pressureAngleDeg,
                thickness_mm: pl.thicknessMm, bore_mm: null, bore_type: 'none',
                label: `planet-${pl.planetTeeth}T`,
              });
              await exportRingGearStep({
                ring_teeth: ringTeeth, module_mm: pl.moduleMm,
                pressure_angle_deg: pl.pressureAngleDeg,
                thickness_mm: pl.thicknessMm, wall_thickness_mm: 3,
                label: `ring-${ringTeeth}T`,
              });
            }
            break;
          }

          default:
            await exportSpurGearStep({
              teeth: g1.teeth, module_mm: m, pressure_angle_deg: pa,
              thickness_mm: g1.thicknessMm, bore_mm: g1.boreDiameterMm ?? null,
              bore_type: toStepBore(g1.boreType), label: `output-${g1.teeth}T`,
            });
            break;
        }

        clearInterval(stepTimerRef.current!);
        stepTimerRef.current = null;
        setProgress(100);
        await new Promise(r => setTimeout(r, 380));
      } catch (e) {
        clearInterval(stepTimerRef.current!);
        stepTimerRef.current = null;
        setStepError(e instanceof Error ? e.message : 'Error desconocido');
        setProgress(0);
      } finally {
        setIsLoading(false);
        setProgress(0);
      }
      return;
    }

    // Sync formats — animate fill, then trigger downloads
    await animateFill(480);

    if (format === 'svg') {
      if (bundle === 'separate') {
        downloadSvg(exportSingleGearSvg(p1, opts), f1('svg'));
        downloadSvg(exportSingleGearSvg(p2, opts), f2('svg'));
      } else {
        downloadSvg(exportGearPairSvg(p1, p2, opts), fp('svg'));
      }
    } else if (format === 'dxf') {
      if (bundle === 'separate') {
        downloadDxf(exportSingleGearDxf(p1, opts), f1('dxf'));
        downloadDxf(exportSingleGearDxf(p2, opts), f2('dxf'));
      } else {
        downloadDxf(exportGearPairDxf(p1, p2, opts), fp('dxf'));
      }
    } else if (format === 'stl') {
      if (bundle === 'separate') {
        downloadStl(exportGearStl(mesh1, 'Output-Gear'), f1('stl'));
        downloadStl(exportGearStl(mesh2, 'Input-Gear'),  f2('stl'));
      } else {
        downloadStl(exportGearStl(mesh1, 'Output-Gear'), fp('stl'));
      }
    } else if (format === 'obj') {
      if (bundle === 'separate') {
        downloadObj(exportGearObj(mesh1, 'Output-Gear'), f1('obj'));
        downloadObj(exportGearObj(mesh2, 'Input-Gear'),  f2('obj'));
      } else {
        downloadObj(exportGearObj(mesh1, 'Output-Gear'), fp('obj'));
      }
    }

    await new Promise(r => setTimeout(r, 220));
    setIsLoading(false);
    setProgress(0);
  };

  const backdropRef = useRef<HTMLDivElement>(null);
  const onBdClick   = (e: React.MouseEvent) => { if (e.target === backdropRef.current) onClose(); };

  const hasCanvas  = CANVAS_MODES.includes(activeMode);
  const showSvg    = isSimple2D(activeMode, is3d) && !!svgUrl;
  const showSnap   = hasCanvas && !!snapshotUrl && !showSvg;
  const showStatic = !hasCanvas;

  return (
    <div className="modal-backdrop" ref={backdropRef} onClick={onBdClick}>
      <div className="export-modal" role="dialog" aria-label="Export gear">

        <div className="export-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="export-modal-title">Export</span>
            <span className="export-mode-badge">{MODE_LABELS[activeMode]}</span>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="export-modal-body">

          <div className="export-modal-preview">
            <div className="export-preview-label">
              {showSvg  ? 'Export preview · 1:1 scale' :
               showSnap ? `${is3d ? '3D' : '2D'} render · current view` :
                          'Gear type reference'}
            </div>
            {showSvg && (
              <>
                <img src={svgUrl} alt="Gear preview" className="export-preview-img" />
                {kerf > 0 && (
                  <div className="kerf-detail-overlay">
                    <KerfDetailView kerf={kerf} moduleMm={moduleMm} />
                  </div>
                )}
              </>
            )}
            {showSnap && (
              <img src={snapshotUrl} alt="3D render preview" className="export-preview-img export-preview-snap" />
            )}
            {showStatic && (
              <div className="export-static-preview">
                <StaticGearPreview activeMode={activeMode} is3d={is3d} />
              </div>
            )}
            {!showSvg && !showSnap && !showStatic && (
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</span>
            )}
          </div>

          <div className="export-modal-settings">

            <div className="export-setting-group">
              <div className="export-setting-label">Format</div>
              {!is3d ? (
                <div className="segmented cols-2" style={{ fontSize: 13 }}>
                  <button className={format === 'svg' ? 'active' : ''} onClick={() => setFormat('svg')}>SVG</button>
                  <button className={format === 'dxf' ? 'active' : ''} onClick={() => setFormat('dxf')}>DXF R12</button>
                </div>
              ) : (
                <div className="segmented cols-3" style={{ fontSize: 13 }}>
                  <button className={format === 'stl' ? 'active' : ''} onClick={() => setFormat('stl')}>STL</button>
                  <button className={format === 'obj' ? 'active' : ''} onClick={() => setFormat('obj')}>OBJ</button>
                  <button className={format === 'step' ? 'active' : ''} onClick={() => setFormat('step')}>STEP</button>
                </div>
              )}
              <p className="fab-hint" style={{ marginTop: 4 }}>
                {format === 'svg'  ? 'Vector, 1:1 scale, layers' :
                 format === 'dxf'  ? 'DXF R12 ASCII, CUT / BORE layers' :
                 format === 'stl'  ? 'ASCII STL, 3D printable mesh' :
                 format === 'step' ? 'B-Rep STEP · CadQuery · calidad CNC/CAD · requiere red' :
                                     'Wavefront OBJ, 3D mesh with vertices'}
              </p>
            </div>

            <div className="export-setting-group">
              <div className="export-setting-label">Archivos</div>
              <div className="segmented cols-2" style={{ fontSize: 13 }}>
                <button className={bundle === 'separate' ? 'active' : ''} onClick={() => setBundle('separate')}>Separados</button>
                <button className={bundle === 'combined' ? 'active' : ''} onClick={() => setBundle('combined')}>Conjunto</button>
              </div>
              <p className="fab-hint" style={{ marginTop: 4 }}>
                {bundle === 'separate'
                  ? `2 archivos — output ${g1.teeth}T + input ${g2.teeth}T`
                  : `1 archivo — par completo ${g1.teeth}T/${g2.teeth}T`}
              </p>
            </div>

            {!is3d && <>
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

            {format === 'step' && stepError && (
              <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 0, marginBottom: 4 }}>
                {stepError}
              </p>
            )}

            <button
              className="export-modal-btn"
              onClick={handleExport}
              disabled={isLoading}
              style={{ '--btn-progress': `${progress}%` } as React.CSSProperties}
            >
              {isLoading && format === 'step' ? (
                <span style={{ opacity: 0.85 }}>Generando STEP…</span>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round"
                       strokeLinejoin="round" strokeWidth={2.5}>
                    <path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>
                  </svg>
                  Export {format.toUpperCase()}
                </>
              )}
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}
