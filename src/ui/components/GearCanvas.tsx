import { useMemo, useEffect, useRef } from 'react';
import type { SpurGear, UnitSystem, ActiveMode, RackPinionParams, InternalGearParams } from '../../core/gearTypes';
import { layoutTwoGears } from '../../geometry/simplePreviewGear';
import { generateSpurGearOutline } from '../../geometry/spurGear2D';
import { toLocalSvgPath } from '../../geometry/polar';
import { calculateExternalGearInitialPhase } from '../../geometry/meshing';
import { fmtModule } from '../../core/units';
import DimensionOverlay from '../svg/DimensionOverlay';
import ScaleBar from '../svg/ScaleBar';
import StaticGearPreview from './StaticGearPreview';
import GearCanvas3D from './GearCanvas3D';
import RackPinionCanvas2D from './RackPinionCanvas2D';
import InternalGearCanvas2D from './InternalGearCanvas2D';
import RackPinionCanvas3D from './RackPinionCanvas3D';
import InternalGearCanvas3D from './InternalGearCanvas3D';

const SVG_W = 620, SVG_H = 420;
const R2D   = 180 / Math.PI;
const OMEGA = (2 * Math.PI) / 18;
const svgDeg = (rad: number) => -(rad * R2D).toFixed(4);

interface AnimatedProps {
  g1: SpurGear; g2: SpurGear; moduleMm: number; pa: number;
  unitSystem: UnitSystem; debug: boolean; showRuler: boolean;
}

function AnimatedSimpleGear({ g1, g2, moduleMm, pa, unitSystem, debug, showRuler }: AnimatedProps) {
  const layout = useMemo(
    () => layoutTwoGears(g1.teeth, g2.teeth, moduleMm, SVG_W, SVG_H),
    [g1.teeth, g2.teeth, moduleMm],
  );
  const { cx1, cy1, cx2, cy2, svgScale } = layout;
  const meshAngle = Math.atan2(-(cy1 - cy2), cx1 - cx2);

  const { driverInitialRotationRad, drivenInitialRotationRad } = useMemo(
    () => calculateExternalGearInitialPhase({ driverTeeth: g2.teeth, drivenTeeth: g1.teeth, meshAngleRad: meshAngle }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [g2.teeth, g1.teeth, cx1, cy1, cx2, cy2],
  );

  const geo1 = useMemo(() => generateSpurGearOutline({ teeth: g1.teeth, moduleMm, pressureAngleDeg: pa }), [g1.teeth, moduleMm, pa]);
  const geo2 = useMemo(() => generateSpurGearOutline({ teeth: g2.teeth, moduleMm, pressureAngleDeg: pa }), [g2.teeth, moduleMm, pa]);
  const localPath1 = useMemo(() => toLocalSvgPath(geo1.outline, svgScale), [geo1.outline, svgScale]);
  const localPath2 = useMemo(() => toLocalSvgPath(geo2.outline, svgScale), [geo2.outline, svgScale]);

  const g1Ref = useRef<SVGGElement>(null);
  const g2Ref = useRef<SVGGElement>(null);
  const live  = useRef({ driverInit: driverInitialRotationRad, drivenInit: drivenInitialRotationRad, z1: g1.teeth, z2: g2.teeth });
  live.current = { driverInit: driverInitialRotationRad, drivenInit: drivenInitialRotationRad, z1: g1.teeth, z2: g2.teeth };

  useEffect(() => {
    let rafId = 0, t0 = 0;
    const frame = (now: DOMHighResTimeStamp) => {
      if (!t0) t0 = now;
      const delta = ((now - t0) / 1000) * OMEGA;
      const { driverInit, drivenInit, z1, z2 } = live.current;
      g2Ref.current?.setAttribute('transform', `rotate(${svgDeg(driverInit - delta)})`);
      g1Ref.current?.setAttribute('transform', `rotate(${svgDeg(drivenInit + delta * (z2 / z1))})`);
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const px = (mm: number) => mm * svgScale;

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
      <line x1={cx2} y1={cy2} x2={cx1} y2={cy1}
        stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="4 4" opacity={0.4} />
      {debug && (
        <g>
          {[{ cx: cx1, cy: cy1, geo: geo1 }, { cx: cx2, cy: cy2, geo: geo2 }].map(({ cx, cy, geo }, i) => (
            <g key={i} opacity={0.55}>
              <circle cx={cx} cy={cy} r={px(geo.rootRadius)}  fill="none" stroke="#94a3b8" strokeWidth={0.75} strokeDasharray="4 3" />
              <circle cx={cx} cy={cy} r={px(geo.outerRadius)} fill="none" stroke="#64748b" strokeWidth={0.75} strokeDasharray="4 3" />
              <circle cx={cx} cy={cy} r={px(geo.baseRadius)}  fill="none" stroke="#60a5fa" strokeWidth={0.75} strokeDasharray="3 3" />
            </g>
          ))}
        </g>
      )}
      <g transform={`translate(${cx1},${cy1})`}>
        <circle r={px(geo1.pitchRadius)} fill="none" stroke="var(--red)" strokeWidth={0.75} strokeDasharray="3 4" opacity={0.35} />
        <g ref={g1Ref} transform={`rotate(${svgDeg(drivenInitialRotationRad)})`}>
          <path d={localPath1} fill="var(--white)" stroke="var(--black)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        </g>
        <circle r={3.5} fill="var(--red)" />
      </g>
      <g transform={`translate(${cx2},${cy2})`}>
        <circle r={px(geo2.pitchRadius)} fill="none" stroke="var(--red)" strokeWidth={0.75} strokeDasharray="3 4" opacity={0.35} />
        <g ref={g2Ref} transform={`rotate(${svgDeg(driverInitialRotationRad)})`}>
          <path d={localPath2} fill="var(--white)" stroke="var(--black)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        </g>
        <circle r={3.5} fill="var(--red)" />
      </g>
      {showRuler && (
        <DimensionOverlay cx1={cx1} cy1={cy1} cx2={cx2} cy2={cy2} geo1={geo1} geo2={geo2} svgScale={svgScale} unitSystem={unitSystem} />
      )}
      <ScaleBar svgScale={svgScale} unitSystem={unitSystem} />
    </svg>
  );
}

interface Props {
  g1: SpurGear; g2: SpurGear; moduleMm: number; pa: number; ratio: number;
  unitSystem: UnitSystem; debug: boolean; showRuler: boolean; is3d: boolean;
  activeMode: ActiveMode;
  rackPinion: RackPinionParams;
  internalGear: InternalGearParams;
}

export default function GearCanvas({ g1, g2, moduleMm, pa, ratio, unitSystem, debug, showRuler, is3d, activeMode, rackPinion, internalGear }: Props) {
  const LIVE_2D: ActiveMode[] = ['simple', 'rack-pinion', 'internal'];
  const LIVE_3D: ActiveMode[] = ['simple', 'rack-pinion', 'internal'];

  const isAnimated = !is3d && LIVE_2D.includes(activeMode);
  const is3DRender = is3d  && LIVE_3D.includes(activeMode);

  return (
    <section className={`stage${is3DRender ? ' stage--three' : ''}`} aria-label="Gear preview">
      {isAnimated && activeMode === 'simple' && (
        <>
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
        </>
      )}

      {isAnimated && activeMode === 'simple' &&
        <AnimatedSimpleGear g1={g1} g2={g2} moduleMm={moduleMm} pa={pa} unitSystem={unitSystem} debug={debug} showRuler={showRuler} />}

      {isAnimated && activeMode === 'rack-pinion' &&
        <RackPinionCanvas2D pinionTeeth={rackPinion.pinionTeeth} moduleMm={rackPinion.moduleMm}
          pressureAngleDeg={rackPinion.pressureAngleDeg} rackLengthMm={rackPinion.rackLengthMm}
          unitSystem={unitSystem} />}

      {isAnimated && activeMode === 'internal' &&
        <InternalGearCanvas2D ringTeeth={internalGear.ringTeeth} pinionTeeth={internalGear.pinionTeeth}
          moduleMm={internalGear.moduleMm} wallThicknessMm={internalGear.wallThicknessMm}
          pressureAngleDeg={internalGear.pressureAngleDeg} />}

      {is3DRender && activeMode === 'simple' &&
        <GearCanvas3D g1={g1} g2={g2} moduleMm={moduleMm} pa={pa} />}

      {is3DRender && activeMode === 'rack-pinion' &&
        <RackPinionCanvas3D {...rackPinion} />}

      {is3DRender && activeMode === 'internal' &&
        <InternalGearCanvas3D {...internalGear} />}

      {!isAnimated && !is3DRender &&
        <StaticGearPreview activeMode={activeMode} is3d={is3d} />}
    </section>
  );
}
