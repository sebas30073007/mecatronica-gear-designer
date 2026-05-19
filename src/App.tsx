import { useState, useMemo, useEffect, useRef } from 'react';
import { useGearStore } from './state/useGearStore';
import { pitchDiameter, externalCenterDistance } from './core/gearMath';
import { gearRatio } from './core/gearRatios';
import { validateGearPair } from './core/validation';
import { layoutTwoGears } from './geometry/simplePreviewGear';
import { generateSpurGearOutline } from './geometry/spurGear2D';
import { toLocalSvgPath } from './geometry/polar';
import { calculateExternalGearInitialPhase } from './geometry/meshing';
import './styles/global.css';

const SVG_W  = 620;
const SVG_H  = 420;
const R2D    = 180 / Math.PI;           // radians → degrees
const OMEGA  = (2 * Math.PI) / 18;     // 1 rev / 18 s  (same as logo gear)
const MODULES = [1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 4.0];

/**
 * Convert a math-coord rotation (rad) to an SVG rotate() angle (degrees).
 *
 * Why negate?  toLocalSvgPath flips Y, mapping math angle θ → SVG local angle −θ.
 * An SVG rotate(δ) adds δ to the SVG angle, so the tooth ends up at screen angle −θ + δ.
 * To place a tooth at screen angle α we need δ = α.
 * Since screen_angle = −math_angle (due to Y-flip), δ = −math_rad * R2D.
 */
const svgDeg = (rad: number) => -(rad * R2D).toFixed(4);

export default function App() {
  const [debug, setDebug]         = useState(false);
  const { gears, setTeeth, setModule } = useGearStore();
  const g1 = gears[0]; // output — large — DRIVEN
  const g2 = gears[1]; // input  — small — DRIVER

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

  // ── Mesh angle: FROM driver (g2) TO driven (g1), in MATH coords (Y up) ────
  // SVG displacement (g2→g1): (cx1−cx2, cy1−cy2_SVG)
  // Math Y = −SVG_Y, so math dy = −(cy1−cy2)
  const meshAngleMath = Math.atan2(-(cy1 - cy2), cx1 - cx2);

  // ── Initial phase (math coords, no Math.round) ─────────────────────────────
  const { driverInitialRotationRad, drivenInitialRotationRad } = useMemo(
    () => calculateExternalGearInitialPhase({
      driverTeeth : g2.teeth,
      drivenTeeth : g1.teeth,
      meshAngleRad: meshAngleMath,
    }),
    // Recompute when teeth or positions change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [g2.teeth, g1.teeth, cx1, cy1, cx2, cy2],
  );

  // ── Gear outlines (memoized — expensive) ──────────────────────────────────
  const geo1 = useMemo(
    () => generateSpurGearOutline({ teeth: g1.teeth, moduleMm, pressureAngleDeg: pa }),
    [g1.teeth, moduleMm, pa],
  );
  const geo2 = useMemo(
    () => generateSpurGearOutline({ teeth: g2.teeth, moduleMm, pressureAngleDeg: pa }),
    [g2.teeth, moduleMm, pa],
  );

  // Local SVG paths: scaled + Y-flipped, centered at origin.
  // Rotation is applied via the animated <g> wrapper — zero React re-renders per frame.
  const localPath1 = useMemo(() => toLocalSvgPath(geo1.outline, svgScale), [geo1.outline, svgScale]);
  const localPath2 = useMemo(() => toLocalSvgPath(geo2.outline, svgScale), [geo2.outline, svgScale]);

  // ── Animation (rAF → direct DOM, bypasses React render loop) ─────────────
  const g1AnimRef  = useRef<SVGGElement>(null);
  const g2AnimRef  = useRef<SVGGElement>(null);

  // Always-current params readable from the rAF closure without dependency churn
  const live = useRef({ driverInit: driverInitialRotationRad, drivenInit: drivenInitialRotationRad,
                        z1: g1.teeth, z2: g2.teeth });
  live.current = { driverInit: driverInitialRotationRad, drivenInit: drivenInitialRotationRad,
                   z1: g1.teeth, z2: g2.teeth };

  useEffect(() => {
    let rafId: number;
    let t0    = 0;

    const frame = (now: DOMHighResTimeStamp) => {
      if (!t0) t0 = now;
      // delta increases with time; negative delta in math → CW on screen for driver
      const delta = ((now - t0) / 1000) * OMEGA;
      const { driverInit, drivenInit, z1, z2 } = live.current;

      // Math angles: driver DECREASES (−delta) → CW on screen
      //              driven INCREASES (+delta·ratio) → CCW on screen
      const driverMath = driverInit - delta;
      const drivenMath = drivenInit + delta * (z2 / z1);

      // svg_rotate = −math_rad * R2D  (Y-flip inversion)
      g2AnimRef.current?.setAttribute('transform', `rotate(${svgDeg(driverMath)})`);
      g1AnimRef.current?.setAttribute('transform', `rotate(${svgDeg(drivenMath)})`);

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []); // runs once; reads live data via ref

  // ── Debug ─────────────────────────────────────────────────────────────────
  const px        = (mm: number) => mm * svgScale;
  const axisLen   = Math.hypot(cx2 - cx1, cy2 - cy1);
  const contactX  = cx1 + (cx2 - cx1) / axisLen * px(geo1.pitchRadius);
  const contactY  = cy1 + (cy2 - cy1) / axisLen * px(geo1.pitchRadius);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">MECATR<span className="gear-o" aria-hidden="true"></span>NICA</div>
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
          <button className="download">Export</button>
        </div>
      </header>

      <aside className="panel left-panel">
        <section className="field">
          <h2 className="field-title">Teeth</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <TeethInput label="Output" value={g1.teeth} onChange={v => setTeeth(g1.id, v)} />
            <TeethInput label="Input"  value={g2.teeth} onChange={v => setTeeth(g2.id, v)} />
          </div>
        </section>

        <section className="field">
          <h2 className="field-title">Ratio</h2>
          <RatioInput ratio={ratio} teethIn={g2.teeth} onTeethOutChange={t => setTeeth(g1.id, t)} />
        </section>

        <section className="field">
          <h2 className="field-title">Module</h2>
          <div className="select-wrap">
            <select className="text-input" value={moduleMm} onChange={e => setModule(parseFloat(e.target.value))}>
              {MODULES.map(m => <option key={m} value={m}>{m.toFixed(2)} mm</option>)}
            </select>
          </div>
        </section>

        <section className="field">
          <h2 className="field-title">Center Distance</h2>
          <div className="result-display">{centerDist.toFixed(2)} mm</div>
        </section>

        {warnings.length > 0 && (
          <section className="field" style={{ marginBottom: 0 }}>
            {warnings.map((w, i) => (
              <div key={i} className={`warn-badge warn-${w.severity}`}>{w.message}</div>
            ))}
          </section>
        )}
      </aside>

      <section className="stage" aria-label="Gear preview">
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
              {/* Exact contact point (pitch circles tangent) */}
              <circle cx={contactX} cy={contactY} r={4}   fill="none"    stroke="#f97316" strokeWidth={1.5} />
              <circle cx={contactX} cy={contactY} r={1.5} fill="#f97316" />
            </g>
          )}

          {/* ── G1: driven / output (large) ──────────────────────────────── */}
          <g transform={`translate(${cx1}, ${cy1})`}>
            <circle r={px(geo1.pitchRadius)}
              fill="none" stroke="var(--red)" strokeWidth={0.75} strokeDasharray="3 4" opacity={0.35} />
            {/* Initial rotation set here; rAF overwrites on first frame */}
            <g ref={g1AnimRef} transform={`rotate(${svgDeg(drivenInitialRotationRad)})`}>
              <path d={localPath1} fill="var(--white)" stroke="var(--black)"
                strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            </g>
            <circle r={3.5} fill="var(--red)" />
          </g>

          {/* ── G2: driver / input (small) ───────────────────────────────── */}
          <g transform={`translate(${cx2}, ${cy2})`}>
            <circle r={px(geo2.pitchRadius)}
              fill="none" stroke="var(--red)" strokeWidth={0.75} strokeDasharray="3 4" opacity={0.35} />
            <g ref={g2AnimRef} transform={`rotate(${svgDeg(driverInitialRotationRad)})`}>
              <path d={localPath2} fill="var(--white)" stroke="var(--black)"
                strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            </g>
            <circle r={3.5} fill="var(--red)" />
          </g>

        </svg>
      </section>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TeethInput({ label, value, onChange }: {
  label: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <input className="text-input" type="number" value={value} min={8} max={200}
        style={{ textAlign: 'center' }}
        onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 8 && v <= 200) onChange(v); }} />
      <div className="mini-label">{label}</div>
    </div>
  );
}

function RatioInput({ ratio, teethIn, onTeethOutChange }: {
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <input className="text-input" type="number" step="0.1" min="0.1" max="50"
        style={{ textAlign: 'right' }}
        value={focused ? local : ratio.toFixed(2)}
        onFocus={() => { setFocused(true); setLocal(ratio.toFixed(2)); }}
        onChange={e => { setLocal(e.target.value); tryApply(e.target.value); }}
        onBlur={() => { tryApply(local); setFocused(false); }}
        onKeyDown={e => { if (e.key === 'Enter') { tryApply(local); (e.target as HTMLInputElement).blur(); } }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 500,
        color: 'var(--text-muted)', flexShrink: 0 }}>: 1</span>
    </div>
  );
}
