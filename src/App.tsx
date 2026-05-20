import { useState, useMemo, useEffect, useRef } from 'react';
import { useGearStore } from './state/useGearStore';
import { pitchDiameter, externalCenterDistance, teethForCenterDistance } from './core/gearMath';
import { gearRatio } from './core/gearRatios';
import { validateGearPair } from './core/validation';
import { layoutTwoGears } from './geometry/simplePreviewGear';
import { generateSpurGearOutline } from './geometry/spurGear2D';
import { toLocalSvgPath } from './geometry/polar';
import { calculateExternalGearInitialPhase } from './geometry/meshing';
import type { SpurGear, ActiveMode, UnitSystem } from './core/gearTypes';
import { fmtLength, fmtModule, MM_PER_INCH, SCALE_NICE_MM, SCALE_NICE_IN, nearestNice } from './core/units';
import { exportSingleGearSvg, exportGearPairSvg } from './exporters/svgExport';
import { exportSingleGearDxf, exportGearPairDxf } from './exporters/dxfExport';
import { downloadSvg, downloadDxf } from './exporters/download';
import './styles/global.css';

const SVG_W  = 620;
const SVG_H  = 420;
const R2D    = 180 / Math.PI;
const OMEGA  = (2 * Math.PI) / 18;
const MODULES = [1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 4.0];

const GEAR_TYPES: { value: ActiveMode; label: string }[] = [
  { value: 'simple',    label: 'Simple Gear Train' },
  { value: 'compound',  label: 'Compound Gear Train' },
  { value: 'planetary', label: 'Planetary (Epicyclic)' },
  { value: 'library',   label: 'Gear Library' },
];

const svgDeg = (rad: number) => -(rad * R2D).toFixed(4);

export default function App() {
  const [debug, setDebug]           = useState(false);
  const [showRuler, setShowRuler]   = useState(false);
  const [helicalAngle, setHelicalAngle] = useState(0);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const {
    gears, setTeeth, setModule, setPressureAngle, setThickness,
    view, unitSystem, activeMode,
    setViewMode, setUnitSystem, setActiveMode,
  } = useGearStore();

  const g1 = gears[0] as SpurGear;
  const g2 = gears[1] as SpurGear;
  if (!g1 || !g2) return null;

  const moduleMm = g1.moduleMm;
  const pa       = g1.pressureAngleDeg;

  // ── Scalar calculations ────────────────────────────────────────────────────
  const d1         = pitchDiameter(moduleMm, g1.teeth);
  const d2         = pitchDiameter(moduleMm, g2.teeth);
  const centerDist = externalCenterDistance(d1, d2);
  const ratio      = gearRatio(g2.teeth, g1.teeth);
  const warnings   = validateGearPair(g1.teeth, g2.teeth, moduleMm);
  if (ratio > 10) warnings.push({
    code: 'RATIO_HIGH',
    message: 'Reducción > 10:1 — considerar tren compuesto.',
    severity: 'warn',
  });

  // ── Layout ────────────────────────────────────────────────────────────────
  const layout = useMemo(
    () => layoutTwoGears(g1.teeth, g2.teeth, moduleMm, SVG_W, SVG_H),
    [g1.teeth, g2.teeth, moduleMm],
  );
  const { cx1, cy1, cx2, cy2, svgScale } = layout;

  const meshAngleMath = Math.atan2(-(cy1 - cy2), cx1 - cx2);

  const { driverInitialRotationRad, drivenInitialRotationRad } = useMemo(
    () => calculateExternalGearInitialPhase({
      driverTeeth : g2.teeth,
      drivenTeeth : g1.teeth,
      meshAngleRad: meshAngleMath,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [g2.teeth, g1.teeth, cx1, cy1, cx2, cy2],
  );

  // ── Gear outlines ─────────────────────────────────────────────────────────
  const geo1 = useMemo(
    () => generateSpurGearOutline({ teeth: g1.teeth, moduleMm, pressureAngleDeg: pa }),
    [g1.teeth, moduleMm, pa],
  );
  const geo2 = useMemo(
    () => generateSpurGearOutline({ teeth: g2.teeth, moduleMm, pressureAngleDeg: pa }),
    [g2.teeth, moduleMm, pa],
  );

  const localPath1 = useMemo(() => toLocalSvgPath(geo1.outline, svgScale), [geo1.outline, svgScale]);
  const localPath2 = useMemo(() => toLocalSvgPath(geo2.outline, svgScale), [geo2.outline, svgScale]);

  // ── Animation (rAF → direct DOM, bypasses React render loop) ─────────────
  const g1AnimRef = useRef<SVGGElement>(null);
  const g2AnimRef = useRef<SVGGElement>(null);
  const live = useRef({ driverInit: driverInitialRotationRad, drivenInit: drivenInitialRotationRad,
                        z1: g1.teeth, z2: g2.teeth });
  live.current = { driverInit: driverInitialRotationRad, drivenInit: drivenInitialRotationRad,
                   z1: g1.teeth, z2: g2.teeth };

  useEffect(() => {
    let rafId: number;
    let t0 = 0;
    const frame = (now: DOMHighResTimeStamp) => {
      if (!t0) t0 = now;
      const delta = ((now - t0) / 1000) * OMEGA;
      const { driverInit, drivenInit, z1, z2 } = live.current;
      const driverMath = driverInit - delta;
      const drivenMath = drivenInit + delta * (z2 / z1);
      g2AnimRef.current?.setAttribute('transform', `rotate(${svgDeg(driverMath)})`);
      g1AnimRef.current?.setAttribute('transform', `rotate(${svgDeg(drivenMath)})`);
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // ── Debug helpers ─────────────────────────────────────────────────────────
  const px       = (mm: number) => mm * svgScale;
  const axisLen  = Math.hypot(cx2 - cx1, cy2 - cy1);
  const contactX = cx1 + (cx2 - cx1) / axisLen * px(geo1.pitchRadius);
  const contactY = cy1 + (cy2 - cy1) / axisLen * px(geo1.pitchRadius);

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (!exportMenuRef.current?.contains(e.target as Node)) setShowExportMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportMenu]);

  const handleExport = (type: 'output' | 'input' | 'pair' | 'output-dxf' | 'input-dxf' | 'pair-dxf') => {
    const p1 = { teeth: g1.teeth, moduleMm: g1.moduleMm, pressureAngleDeg: g1.pressureAngleDeg, boreDiameterMm: g1.boreDiameterMm, label: 'Output-Gear' };
    const p2 = { teeth: g2.teeth, moduleMm: g2.moduleMm, pressureAngleDeg: g2.pressureAngleDeg, boreDiameterMm: g2.boreDiameterMm, label: 'Input-Gear' };
    const m  = g1.moduleMm;
    if (type === 'output')     downloadSvg(exportSingleGearSvg(p1), `gear-output-${g1.teeth}T-M${m}.svg`);
    if (type === 'input')      downloadSvg(exportSingleGearSvg(p2), `gear-input-${g2.teeth}T-M${m}.svg`);
    if (type === 'pair')       downloadSvg(exportGearPairSvg(p1, p2), `gear-pair-${g1.teeth}T-${g2.teeth}T-M${m}.svg`);
    if (type === 'output-dxf') downloadDxf(exportSingleGearDxf(p1), `gear-output-${g1.teeth}T-M${m}.dxf`);
    if (type === 'input-dxf')  downloadDxf(exportSingleGearDxf(p2), `gear-input-${g2.teeth}T-M${m}.dxf`);
    if (type === 'pair-dxf')   downloadDxf(exportGearPairDxf(p1, p2), `gear-pair-${g1.teeth}T-${g2.teeth}T-M${m}.dxf`);
    setShowExportMenu(false);
  };

  const is3d = view.mode === '3d';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app">

      {/* ── Topbar ── */}
      <header className="topbar">
        <div className="logo">MECATR<span className="gear-o" aria-hidden="true" /></div>
        <div className="topbar-center">
          <div className="topbar-crumb">
            <span>Projects</span><span className="sep">/</span><span className="current">Reductora-01</span>
          </div>
          <div className="topbar-title">Gear Designer</div>
        </div>
        <div className="topbar-actions">
          <button className="icon-action" title="Debug overlay"
            style={{ color: debug ? 'var(--red)' : undefined }}
            onClick={() => setDebug(v => !v)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <circle cx="12" cy="12" r="7" strokeDasharray="3 2"/>
              <circle cx="12" cy="12" r="10" strokeDasharray="2 3" opacity=".5"/>
            </svg>
          </button>
          <button className="icon-action" title="Dimensiones"
            style={{ color: showRuler ? 'var(--red)' : undefined }}
            onClick={() => setShowRuler(v => !v)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="10" rx="1.5" strokeWidth={1.75}/>
              <line x1="6"  y1="7" x2="6"  y2="11" strokeWidth={1.5}/>
              <line x1="10" y1="7" x2="10" y2="12" strokeWidth={1.5}/>
              <line x1="14" y1="7" x2="14" y2="11" strokeWidth={1.5}/>
              <line x1="18" y1="7" x2="18" y2="11" strokeWidth={1.5}/>
            </svg>
          </button>
          <div className="export-wrap" ref={exportMenuRef}>
            <button className={`download${showExportMenu ? ' active' : ''}`}
              onClick={() => setShowExportMenu(v => !v)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>
              </svg>
              Export
              <svg viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
                style={{ width: 10, height: 6, marginLeft: 2, opacity: 0.7 }}>
                <path d="M1 1l4 4 4-4"/>
              </svg>
            </button>
            {showExportMenu && (
              <div className="export-menu">
                <div className="menu-label">SVG</div>
                <button onClick={() => handleExport('output')}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: 14, height: 14, flexShrink: 0 }}>
                    <circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="3" strokeDasharray="2 1"/>
                  </svg>
                  Output gear ({g1.teeth}T)
                </button>
                <button onClick={() => handleExport('input')}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: 14, height: 14, flexShrink: 0 }}>
                    <circle cx="8" cy="8" r="4"/><circle cx="8" cy="8" r="2" strokeDasharray="2 1"/>
                  </svg>
                  Input gear ({g2.teeth}T)
                </button>
                <button onClick={() => handleExport('pair')}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: 14, height: 14, flexShrink: 0 }}>
                    <circle cx="5" cy="8" r="4"/><circle cx="11" cy="8" r="2.5"/>
                  </svg>
                  Gear pair
                </button>
                <hr/>
                <div className="menu-label">DXF (R12)</div>
                <button onClick={() => handleExport('output-dxf')}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: 14, height: 14, flexShrink: 0 }}>
                    <circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="3" strokeDasharray="2 1"/>
                  </svg>
                  Output gear ({g1.teeth}T)
                </button>
                <button onClick={() => handleExport('input-dxf')}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: 14, height: 14, flexShrink: 0 }}>
                    <circle cx="8" cy="8" r="4"/><circle cx="8" cy="8" r="2" strokeDasharray="2 1"/>
                  </svg>
                  Input gear ({g2.teeth}T)
                </button>
                <button onClick={() => handleExport('pair-dxf')}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: 14, height: 14, flexShrink: 0 }}>
                    <circle cx="5" cy="8" r="4"/><circle cx="11" cy="8" r="2.5"/>
                  </svg>
                  Gear pair
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Left panel ── */}
      <aside className="panel left-panel">

        <section className="field">
          <h2 className="field-title">Type</h2>
          <div className="select-wrap">
            <select className="text-input" value={activeMode}
              onChange={e => setActiveMode(e.target.value as ActiveMode)}>
              {GEAR_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </section>

        <section className="field">
          <h2 className="field-title">Ratio Target</h2>
          <RatioRow ratio={ratio} teethIn={g2.teeth} onTeethOutChange={t => setTeeth(g1.id, t)} />
        </section>

        <section className="field">
          <h2 className="field-title">Teeth</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <TeethStepper label="Output" value={g1.teeth} onChange={v => setTeeth(g1.id, v)} />
            <TeethStepper label="Input"  value={g2.teeth} onChange={v => setTeeth(g2.id, v)} />
          </div>
        </section>

        <section className="field">
          <h2 className="field-title">Center Distance</h2>
          <CenterDistanceInput
            valueMm={centerDist}
            moduleMm={moduleMm}
            ratio={ratio}
            unitSystem={unitSystem}
            onTeethChange={(t1, t2) => { setTeeth(g1.id, t1); setTeeth(g2.id, t2); }}
          />
        </section>

        <section className="field">
          <h2 className="field-title">Module</h2>
          <div className="select-wrap">
            <select className="text-input" value={moduleMm}
              onChange={e => setModule(parseFloat(e.target.value))}>
              {MODULES.map(m => <option key={m} value={m}>{fmtModule(m, unitSystem)}</option>)}
            </select>
          </div>
        </section>

        <section className="field">
          <h2 className="field-title">Pressure Angle</h2>
          <div className="segmented cols-3">
            {([14.5, 20, 25] as const).map(deg => (
              <button key={deg} className={pa === deg ? 'active' : ''}
                onClick={() => setPressureAngle(deg)}>
                {deg}°
              </button>
            ))}
          </div>
        </section>

        <section className="field" style={{ marginBottom: warnings.length > 0 ? 22 : 0 }}>
          <h2 className="field-title">Units</h2>
          <div className="segmented cols-2">
            <button className={unitSystem === 'metric'   ? 'active' : ''}
              onClick={() => setUnitSystem('metric')}>mm</button>
            <button className={unitSystem === 'imperial' ? 'active' : ''}
              onClick={() => setUnitSystem('imperial')}>in</button>
          </div>
        </section>

        {warnings.length > 0 && (
          <section className="field" style={{ marginBottom: 0 }}>
            {warnings.map((w, i) => (
              <div key={i} className={`warn-badge warn-${w.severity}`}>{w.message}</div>
            ))}
          </section>
        )}
      </aside>

      {/* ── View toggle 2D / 3D ── */}
      <div className={`view-toggle${is3d ? ' with-panel' : ''}`}>
        <button className={!is3d ? 'active' : ''} onClick={() => setViewMode('2d')}>2D</button>
        <button className={ is3d ? 'active' : ''} onClick={() => setViewMode('3d')}>3D</button>
      </div>

      {/* ── Right panel (3D mode) ── */}
      <aside className={`panel right-panel${is3d ? ' visible' : ''}`}>
        <section className="field">
          <h2 className="field-title">Thickness</h2>
          <input className="text-input" type="number" min={0.1} max={500} step={unitSystem === 'imperial' ? 0.01 : 0.5}
            value={unitSystem === 'imperial'
              ? parseFloat((g1.thicknessMm / MM_PER_INCH).toFixed(4))
              : g1.thicknessMm}
            onChange={e => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v > 0)
                setThickness(unitSystem === 'imperial' ? v * MM_PER_INCH : v);
            }} />
        </section>
        <section className="field">
          <h2 className="field-title">Helical Angle</h2>
          <div className="segmented cols-4">
            {([0, 15, 20, 30] as const).map(deg => (
              <button key={deg} className={helicalAngle === deg ? 'active' : ''}
                onClick={() => setHelicalAngle(deg)}>
                {deg}°
              </button>
            ))}
          </div>
        </section>
      </aside>

      {/* ── Stage ── */}
      <section className={`stage${is3d ? ' mode-3d' : ''}`} aria-label="Gear preview">

        <div className="stage-annotation ann-tl">
          <span className="ann-dot" />
          <span className="ann-label">Ratio</span>
          <span className="ann-value">{ratio.toFixed(1)} : 1</span>
        </div>
        <div className="stage-annotation ann-br">
          <span className="ann-dot" style={{ background: 'var(--text-strong)' }} />
          <span className="ann-label">Module</span>
          <span className="ann-value">{fmtModule(moduleMm, unitSystem)}</span>
        </div>

        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`}>

          {/* Axis line */}
          <line x1={cx2} y1={cy2} x2={cx1} y2={cy1}
            stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="4 4" opacity={0.4} />

          {/* Debug overlay */}
          {debug && (
            <g>
              {[{ cx: cx1, cy: cy1, geo: geo1 }, { cx: cx2, cy: cy2, geo: geo2 }].map(({ cx, cy, geo }, i) => (
                <g key={i} opacity={0.55}>
                  <circle cx={cx} cy={cy} r={px(geo.rootRadius)}
                    fill="none" stroke="#94a3b8" strokeWidth={0.75} strokeDasharray="4 3" />
                  <circle cx={cx} cy={cy} r={px(geo.outerRadius)}
                    fill="none" stroke="#64748b" strokeWidth={0.75} strokeDasharray="4 3" />
                  <circle cx={cx} cy={cy} r={px(geo.baseRadius)}
                    fill="none" stroke="#60a5fa" strokeWidth={0.75} strokeDasharray="3 3" />
                </g>
              ))}
              <circle cx={contactX} cy={contactY} r={4}   fill="none"    stroke="#f97316" strokeWidth={1.5} />
              <circle cx={contactX} cy={contactY} r={1.5} fill="#f97316" />
            </g>
          )}

          {/* G1: driven / output (large) */}
          <g transform={`translate(${cx1}, ${cy1})`}>
            <circle r={px(geo1.pitchRadius)}
              fill="none" stroke="var(--red)" strokeWidth={0.75} strokeDasharray="3 4" opacity={0.35} />
            <g ref={g1AnimRef} transform={`rotate(${svgDeg(drivenInitialRotationRad)})`}>
              <path d={localPath1} fill="var(--white)" stroke="var(--black)"
                strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            </g>
            <circle r={3.5} fill="var(--red)" />
          </g>

          {/* G2: driver / input (small) */}
          <g transform={`translate(${cx2}, ${cy2})`}>
            <circle r={px(geo2.pitchRadius)}
              fill="none" stroke="var(--red)" strokeWidth={0.75} strokeDasharray="3 4" opacity={0.35} />
            <g ref={g2AnimRef} transform={`rotate(${svgDeg(driverInitialRotationRad)})`}>
              <path d={localPath2} fill="var(--white)" stroke="var(--black)"
                strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            </g>
            <circle r={3.5} fill="var(--red)" />
          </g>

          {/* Dimension overlay */}
          {showRuler && (
            <DimensionOverlay
              cx1={cx1} cy1={cy1} cx2={cx2} cy2={cy2}
              geo1={geo1} geo2={geo2} svgScale={svgScale}
              unitSystem={unitSystem}
            />
          )}

          {/* Scale bar */}
          <ScaleBar svgScale={svgScale} unitSystem={unitSystem} />

        </svg>
      </section>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TeethStepper({ label, value, onChange }: {
  label: string; value: number; onChange: (v: number) => void;
}) {
  const clamp = (n: number) => Math.max(8, Math.min(200, n));
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

function RatioRow({ ratio, teethIn, onTeethOutChange }: {
  ratio: number; teethIn: number; onTeethOutChange: (t: number) => void;
}) {
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

function CenterDistanceInput({ valueMm, moduleMm, ratio, unitSystem, onTeethChange }: {
  valueMm: number; moduleMm: number; ratio: number;
  unitSystem: UnitSystem; onTeethChange: (t1: number, t2: number) => void;
}) {
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

// ─── Dimension overlay ────────────────────────────────────────────────────────

const DIM_FONT   = `11px/1 "JetBrains Mono", ui-monospace, monospace`;
const DIM_GAP    = 12;
const DIM_OFFSET = 10;
const ARROW_S    = 5;

function arrow(x: number, y: number, ux: number, uy: number): string {
  const s = ARROW_S, px = -uy, py = ux;
  return [
    `M${x.toFixed(1)},${y.toFixed(1)}`,
    `L${(x - ux*s + px*s*0.45).toFixed(1)},${(y - uy*s + py*s*0.45).toFixed(1)}`,
    `L${(x - ux*s - px*s*0.45).toFixed(1)},${(y - uy*s - py*s*0.45).toFixed(1)}`,
    'Z',
  ].join(' ');
}

function DiamAnnotation({ cx, cy, r, label, color }: {
  cx: number; cy: number; r: number; label: string; color: string;
}) {
  const lineY = cy - r - DIM_GAP - DIM_OFFSET;
  const x1 = cx - r, x2 = cx + r;
  return (
    <g>
      <line x1={x1} y1={lineY} x2={x1} y2={cy - r}
        stroke={color} strokeWidth={0.75} strokeDasharray="3 3" opacity={0.6} />
      <line x1={x2} y1={lineY} x2={x2} y2={cy - r}
        stroke={color} strokeWidth={0.75} strokeDasharray="3 3" opacity={0.6} />
      <line x1={x1} y1={lineY} x2={x2} y2={lineY} stroke={color} strokeWidth={1} />
      <path d={arrow(x1, lineY,  1, 0)} fill={color} />
      <path d={arrow(x2, lineY, -1, 0)} fill={color} />
      <text x={(x1 + x2) / 2} y={lineY - 6}
        textAnchor="middle" style={{ font: DIM_FONT, letterSpacing: '0.05em' }} fill={color}>
        {label}
      </text>
    </g>
  );
}

function DimensionOverlay({ cx1, cy1, cx2, cy2, geo1, geo2, svgScale, unitSystem }: {
  cx1: number; cy1: number; cx2: number; cy2: number;
  geo1: ReturnType<typeof generateSpurGearOutline>;
  geo2: ReturnType<typeof generateSpurGearOutline>;
  svgScale: number;
  unitSystem: UnitSystem;
}) {
  const r1   = geo1.outerRadius * svgScale;
  const r2   = geo2.outerRadius * svgScale;
  const dia1 = fmtLength(geo1.outerRadius * 2, unitSystem);
  const dia2 = fmtLength(geo2.outerRadius * 2, unitSystem);

  const dx = cx2 - cx1, dy = cy2 - cy1;
  const dist = Math.hypot(dx, dy);
  const ux = dx / dist, uy = dy / dist;
  let nx = -uy, ny = ux;
  if (ny < 0) { nx = uy; ny = -ux; }

  const cdOff = Math.max(r1, r2) + 24;
  const ax1 = cx1 + nx * cdOff, ay1 = cy1 + ny * cdOff;
  const ax2 = cx2 + nx * cdOff, ay2 = cy2 + ny * cdOff;
  const mx  = (ax1 + ax2) / 2, my = (ay1 + ay2) / 2;
  const cdStr = fmtLength(dist / svgScale, unitSystem);
  const tx = mx + nx * 11, ty = my + ny * 11;
  const labelAngleDeg = Math.atan2(ay2 - ay1, ax2 - ax1) * (180 / Math.PI);

  const RED  = 'var(--red)';
  const GRAY = '#475569';

  return (
    <g>
      <DiamAnnotation cx={cx1} cy={cy1} r={r1} label={`Ø ${dia1}`} color={RED} />
      <DiamAnnotation cx={cx2} cy={cy2} r={r2} label={`Ø ${dia2}`} color={RED} />
      <line x1={cx1} y1={cy1} x2={ax1} y2={ay1}
        stroke={GRAY} strokeWidth={0.75} strokeDasharray="3 3" opacity={0.6} />
      <line x1={cx2} y1={cy2} x2={ax2} y2={ay2}
        stroke={GRAY} strokeWidth={0.75} strokeDasharray="3 3" opacity={0.6} />
      <line x1={ax1} y1={ay1} x2={ax2} y2={ay2} stroke={GRAY} strokeWidth={1} />
      <path d={arrow(ax1, ay1,  ux,  uy)} fill={GRAY} />
      <path d={arrow(ax2, ay2, -ux, -uy)} fill={GRAY} />
      <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle"
        transform={`rotate(${labelAngleDeg}, ${tx}, ${ty})`}
        style={{ font: DIM_FONT, letterSpacing: '0.05em' }} fill={GRAY}>
        {cdStr}
      </text>
    </g>
  );
}

// ─── Scale bar ────────────────────────────────────────────────────────────────

function ScaleBar({ svgScale, unitSystem }: { svgScale: number; unitSystem: UnitSystem }) {
  const targetMm = 90 / svgScale;
  let barPx: number;
  let label: string;

  if (unitSystem === 'imperial') {
    const targetIn = targetMm / MM_PER_INCH;
    const scaleIn  = nearestNice(targetIn, SCALE_NICE_IN);
    barPx = scaleIn * MM_PER_INCH * svgScale;
    label = scaleIn < 1 ? `${scaleIn}"` : `${scaleIn.toFixed(0)}"`;
  } else {
    const scaleMm = nearestNice(targetMm, SCALE_NICE_MM);
    barPx = scaleMm * svgScale;
    label = `${scaleMm} mm`;
  }

  const x    = SVG_W - 22 - barPx;
  const y    = SVG_H - 22;
  const tick = 4;

  return (
    <g opacity={0.9}>
      <line x1={x} y1={y} x2={x + barPx} y2={y}
        stroke="var(--red)" strokeWidth={1.5} strokeLinecap="round" />
      <line x1={x}         y1={y - tick} x2={x}         y2={y + tick}
        stroke="var(--red)" strokeWidth={1.5} strokeLinecap="round" />
      <line x1={x + barPx} y1={y - tick} x2={x + barPx} y2={y + tick}
        stroke="var(--red)" strokeWidth={1.5} strokeLinecap="round" />
      <text x={x + barPx / 2} y={y - 8} textAnchor="middle"
        style={{ font: '9px/1 "JetBrains Mono", ui-monospace, monospace', letterSpacing: '0.06em' }}
        fill="var(--red)">
        {label}
      </text>
    </g>
  );
}
