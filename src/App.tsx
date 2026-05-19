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
  const [showRuler, setShowRuler] = useState(false);
  const { gears, setTeeth, setModule, setPressureAngle } = useGearStore();
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
          <button className="download">Export</button>
        </div>
      </header>

      <aside className="panel left-panel">
        <section className="field">
          <h2 className="field-title">Teeth</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <TeethStepper label="Output" value={g1.teeth} onChange={v => setTeeth(g1.id, v)} />
            <TeethStepper label="Input"  value={g2.teeth} onChange={v => setTeeth(g2.id, v)} />
          </div>
        </section>

        <section className="field">
          <h2 className="field-title">Ratio</h2>
          <RatioInput ratio={ratio} teethIn={g2.teeth} onTeethOutChange={t => setTeeth(g1.id, t)} />
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

          {/* Dimension overlay */}
          {showRuler && (
            <DimensionOverlay
              cx1={cx1} cy1={cy1} cx2={cx2} cy2={cy2}
              geo1={geo1} geo2={geo2} svgScale={svgScale}
            />
          )}

          {/* Scale bar */}
          <ScaleBar svgScale={svgScale} />

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

// ─── Dimension overlay ────────────────────────────────────────────────────────

const DIM_FONT   = `11px/1 "JetBrains Mono", ui-monospace, monospace`;
const DIM_GAP    = 12;   // px between gear edge and extension line end
const DIM_OFFSET = 10;   // px between gear edge and dimension line
const ARROW_S    = 5;    // arrow size px

/** Filled arrowhead at (x,y) pointing in direction (ux,uy). */
function arrow(x: number, y: number, ux: number, uy: number): string {
  const s = ARROW_S, px = -uy, py = ux;
  return [
    `M${x.toFixed(1)},${y.toFixed(1)}`,
    `L${(x - ux*s + px*s*0.45).toFixed(1)},${(y - uy*s + py*s*0.45).toFixed(1)}`,
    `L${(x - ux*s - px*s*0.45).toFixed(1)},${(y - uy*s - py*s*0.45).toFixed(1)}`,
    'Z',
  ].join(' ');
}

/** Horizontal diameter annotation above a gear. */
function DiamAnnotation({ cx, cy, r, label, color }: {
  cx: number; cy: number; r: number; label: string; color: string;
}) {
  const lineY = cy - r - DIM_GAP - DIM_OFFSET;
  const x1 = cx - r, x2 = cx + r;
  return (
    <g>
      {/* Extension lines — dashed guides from dimension line down to gear tangent */}
      <line x1={x1} y1={lineY} x2={x1} y2={cy - r}
        stroke={color} strokeWidth={0.75} strokeDasharray="3 3" opacity={0.6} />
      <line x1={x2} y1={lineY} x2={x2} y2={cy - r}
        stroke={color} strokeWidth={0.75} strokeDasharray="3 3" opacity={0.6} />
      {/* Dimension line */}
      <line x1={x1} y1={lineY} x2={x2} y2={lineY} stroke={color} strokeWidth={1} />
      {/* Arrows — pointing inward */}
      <path d={arrow(x1, lineY,  1, 0)} fill={color} />
      <path d={arrow(x2, lineY, -1, 0)} fill={color} />
      {/* Label */}
      <text x={(x1 + x2) / 2} y={lineY - 6}
        textAnchor="middle" style={{ font: DIM_FONT, letterSpacing: '0.05em' }} fill={color}>
        {label}
      </text>
    </g>
  );
}

function DimensionOverlay({ cx1, cy1, cx2, cy2, geo1, geo2, svgScale }: {
  cx1: number; cy1: number; cx2: number; cy2: number;
  geo1: ReturnType<typeof generateSpurGearOutline>;
  geo2: ReturnType<typeof generateSpurGearOutline>;
  svgScale: number;
}) {
  const r1   = geo1.outerRadius * svgScale;
  const r2   = geo2.outerRadius * svgScale;
  const dia1 = (geo1.outerRadius * 2).toFixed(2);
  const dia2 = (geo2.outerRadius * 2).toFixed(2);

  // ── Center distance annotation ──────────────────────────────────────────
  const dx = cx2 - cx1, dy = cy2 - cy1;
  const dist = Math.hypot(dx, dy);
  const ux = dx / dist, uy = dy / dist;               // axis unit vector

  // Perpendicular pointing toward higher SVG Y (downward on screen)
  let nx = -uy, ny = ux;
  if (ny < 0) { nx = uy; ny = -ux; }

  // Offset the annotation line away from the axis
  const cdOff = Math.max(r1, r2) + 24;
  const ax1 = cx1 + nx * cdOff, ay1 = cy1 + ny * cdOff;
  const ax2 = cx2 + nx * cdOff, ay2 = cy2 + ny * cdOff;
  const mx  = (ax1 + ax2) / 2, my = (ay1 + ay2) / 2;
  const cdMm = (dist / svgScale).toFixed(2);

  // Text: perpendicular offset from midpoint, away from the line
  const tx = mx + nx * 11, ty = my + ny * 11;

  // Angle for the label so it follows the axis direction
  const labelAngleDeg = Math.atan2(ay2 - ay1, ax2 - ax1) * R2D;

  const RED  = 'var(--red)';
  const GRAY = '#475569';

  return (
    <g>
      {/* Outer Ø — g1 (large, output) */}
      <DiamAnnotation cx={cx1} cy={cy1} r={r1} label={`Ø ${dia1} mm`} color={RED} />
      {/* Outer Ø — g2 (small, input) */}
      <DiamAnnotation cx={cx2} cy={cy2} r={r2} label={`Ø ${dia2} mm`} color={RED} />

      {/* Center distance — extension lines from gear centers to annotation line */}
      <line x1={cx1} y1={cy1} x2={ax1} y2={ay1}
        stroke={GRAY} strokeWidth={0.75} strokeDasharray="3 3" opacity={0.6} />
      <line x1={cx2} y1={cy2} x2={ax2} y2={ay2}
        stroke={GRAY} strokeWidth={0.75} strokeDasharray="3 3" opacity={0.6} />
      {/* Annotation line */}
      <line x1={ax1} y1={ay1} x2={ax2} y2={ay2} stroke={GRAY} strokeWidth={1} />
      {/* Arrows — inward along axis */}
      <path d={arrow(ax1, ay1,  ux,  uy)} fill={GRAY} />
      <path d={arrow(ax2, ay2, -ux, -uy)} fill={GRAY} />
      {/* Label — rotated to follow the axis */}
      <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle"
        transform={`rotate(${labelAngleDeg}, ${tx}, ${ty})`}
        style={{ font: DIM_FONT, letterSpacing: '0.05em' }} fill={GRAY}>
        {cdMm} mm
      </text>
    </g>
  );
}

// ─── Scale bar ────────────────────────────────────────────────────────────────

const NICE_MM = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500];

function ScaleBar({ svgScale }: { svgScale: number }) {
  // Target ~90 px → find the nearest "nice" mm value
  const targetMm = 90 / svgScale;
  const scaleMm  = NICE_MM.reduce((best, v) =>
    Math.abs(v - targetMm) < Math.abs(best - targetMm) ? v : best,
  );
  const barPx = scaleMm * svgScale;

  // Bottom-right of the viewBox, right-aligned
  const x    = SVG_W - 22 - barPx;
  const y    = SVG_H - 22;
  const tick = 4;

  return (
    <g opacity={0.9}>
      {/* Horizontal rule */}
      <line x1={x} y1={y} x2={x + barPx} y2={y}
        stroke="var(--red)" strokeWidth={1.5} strokeLinecap="round" />
      {/* End ticks */}
      <line x1={x}         y1={y - tick} x2={x}         y2={y + tick}
        stroke="var(--red)" strokeWidth={1.5} strokeLinecap="round" />
      <line x1={x + barPx} y1={y - tick} x2={x + barPx} y2={y + tick}
        stroke="var(--red)" strokeWidth={1.5} strokeLinecap="round" />
      {/* Label */}
      <text
        x={x + barPx / 2} y={y - 8}
        textAnchor="middle"
        style={{ font: '9px/1 "JetBrains Mono", ui-monospace, monospace', letterSpacing: '0.06em' }}
        fill="var(--red)"
      >
        {scaleMm} mm
      </text>
    </g>
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
