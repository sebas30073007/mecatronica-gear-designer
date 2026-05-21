import { useMemo, useEffect, useRef } from 'react';
import { generateSpurGearOutline } from '../../geometry/spurGear2D';
import { toLocalSvgPath } from '../../geometry/polar';

const SVG_W = 620, SVG_H = 420;
const R2D = 180 / Math.PI;
const OMEGA = (2 * Math.PI) / 18;

interface Props {
  ringTeeth:        number;
  pinionTeeth:      number;
  moduleMm:         number;
  pressureAngleDeg: number;
  wallThicknessMm:  number;
}

/**
 * Compound path for the ring gear using even-odd fill:
 * - outer circle (solid ring body)
 * - inner gear profile with teeth pointing inward (creates transparent bore + teeth)
 */
function ringGearPath(
  cx: number, cy: number,
  R_outer: number,
  R_root: number,
  R_tip: number,
  teeth: number,
): string {
  // Outer circle (approximated as 64-segment polygon)
  const N = 64;
  let d = '';
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    d += `${i === 0 ? 'M' : 'L'} ${(cx + R_outer * Math.cos(a)).toFixed(1)} ${(cy + R_outer * Math.sin(a)).toFixed(1)} `;
  }
  d += 'Z ';

  // Inner gear profile: teeth point inward from R_root to R_tip
  const pitchAngle = (Math.PI * 2) / teeth;
  const halfRoot   = pitchAngle * 0.35;   // tooth arc at root  (70% of pitch = tooth)
  const halfTip    = pitchAngle * 0.22;   // tooth arc at tip   (44% of pitch = tip)

  for (let i = 0; i < teeth; i++) {
    const tc           = (i / teeth) * Math.PI * 2;    // tooth center angle
    const prevRootEnd  = tc - pitchAngle + halfRoot;   // right edge of prev tooth (at R_root)
    const thisRootStart = tc - halfRoot;               // left edge of this tooth  (at R_root)

    // Arc at R_root from prevRootEnd → thisRootStart (the space between teeth)
    for (let s = 0; s <= 2; s++) {
      const a = prevRootEnd + (s / 2) * (thisRootStart - prevRootEnd);
      const x = (cx + R_root * Math.cos(a)).toFixed(1);
      const y = (cy + R_root * Math.sin(a)).toFixed(1);
      d += `${i === 0 && s === 0 ? 'M' : 'L'} ${x} ${y} `;
    }

    // Tooth flanks: left root → left tip → right tip → right root
    d += `L ${(cx + R_tip * Math.cos(tc - halfTip)).toFixed(1)} ${(cy + R_tip * Math.sin(tc - halfTip)).toFixed(1)} `;
    d += `L ${(cx + R_tip * Math.cos(tc + halfTip)).toFixed(1)} ${(cy + R_tip * Math.sin(tc + halfTip)).toFixed(1)} `;
    d += `L ${(cx + R_root * Math.cos(tc + halfRoot)).toFixed(1)} ${(cy + R_root * Math.sin(tc + halfRoot)).toFixed(1)} `;
  }
  d += 'Z';

  return d;
}

export default function InternalGearCanvas2D({
  ringTeeth, pinionTeeth, moduleMm, pressureAngleDeg, wallThicknessMm,
}: Props) {
  const R_ring_mm  = (ringTeeth * moduleMm) / 2;
  const R_pin_mm   = (pinionTeeth * moduleMm) / 2;
  const cd_mm      = R_ring_mm - R_pin_mm;
  const ratio      = ringTeeth / pinionTeeth;

  // Scale: ring pitch radius → ~155px max
  const scale     = Math.min(155 / R_ring_mm, 4);
  const R_ring    = R_ring_mm * scale;           // pitch circle radius (px)
  const R_pin     = R_pin_mm  * scale;
  const cd        = cd_mm * scale;
  const wallDisp  = wallThicknessMm * scale;

  // Ring geometry
  const ded_px   = 1.25 * moduleMm * scale;
  const add_px   = moduleMm * scale;
  const R_root   = R_ring + ded_px;             // inner surface (tooth root circle)
  const R_tip    = R_ring - add_px;             // tooth tip circle (pointing inward)
  const R_outer  = R_root + wallDisp;           // outer edge of ring body

  const ringCX = SVG_W / 2, ringCY = SVG_H / 2;
  const pinCX  = ringCX + cd;
  const pinCY  = ringCY;

  const ringPath = useMemo(
    () => ringGearPath(ringCX, ringCY, R_outer, R_root, R_tip, ringTeeth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ringCX, ringCY, R_outer, R_root, R_tip, ringTeeth],
  );

  const geoPin = useMemo(
    () => generateSpurGearOutline({ teeth: pinionTeeth, moduleMm, pressureAngleDeg }),
    [pinionTeeth, moduleMm, pressureAngleDeg],
  );
  const pinPath = useMemo(() => toLocalSvgPath(geoPin.outline, scale), [geoPin.outline, scale]);

  const ringRef = useRef<SVGGElement>(null);
  const pinRef  = useRef<SVGGElement>(null);
  const live    = useRef({ ratio, R_ring, R_pin, ringCX, ringCY });
  live.current  = { ratio, R_ring, R_pin, ringCX, ringCY };

  // Initial phase: gap at leftward (toward ring center) for pinion
  const pitchAngleDeg = 360 / pinionTeeth;
  const kPhase        = Math.round(180 / pitchAngleDeg - 0.5);
  const initPinPhase  = (180 - (kPhase + 0.5) * pitchAngleDeg) * (Math.PI / 180);

  useEffect(() => {
    let rafId: number, t0 = 0;
    const frame = (now: DOMHighResTimeStamp) => {
      if (!t0) t0 = now;
      const el  = (now - t0) / 1000;
      const { ratio: rv, ringCX: rcx, ringCY: rcy } = live.current;

      const pinAngle  = el * OMEGA + initPinPhase;
      const ringAngle = el * OMEGA / rv;

      pinRef.current?.setAttribute('transform', `rotate(${(pinAngle * R2D).toFixed(3)})`);
      ringRef.current?.setAttribute('transform',
        `rotate(${(ringAngle * R2D).toFixed(3)}, ${rcx}, ${rcy})`);
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
      {/* Ring gear — rotating group */}
      <g ref={ringRef}>
        {/* Ring body with internal teeth: even-odd fill creates transparent bore */}
        <path
          fillRule="evenodd"
          d={ringPath}
          fill="var(--white)"
          stroke="var(--black)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {/* Pitch circle */}
        <circle cx={ringCX} cy={ringCY} r={R_ring}
          fill="none" stroke="var(--red)" strokeWidth={0.65} strokeDasharray="3 4" opacity={0.3} />
      </g>

      {/* Center distance line */}
      <line x1={ringCX} y1={ringCY} x2={pinCX} y2={pinCY}
        stroke="var(--text-muted)" strokeWidth={0.8} strokeDasharray="3 3" opacity={0.35} />

      {/* Pinion — rotating around its own center */}
      <g transform={`translate(${pinCX}, ${pinCY})`}>
        <circle r={R_pin} fill="none" stroke="var(--red)"
          strokeWidth={0.65} strokeDasharray="3 4" opacity={0.3} />
        <g ref={pinRef}>
          <path d={pinPath} fill="var(--white)" stroke="var(--black)"
            strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        </g>
        <circle r={3.5} fill="var(--red)" />
      </g>

      {/* Ring center dot */}
      <circle cx={ringCX} cy={ringCY} r={3.5} fill="var(--red)" />

      {/* Annotations */}
      <text x={ringCX} y={ringCY - R_outer - 10}
        fontFamily="var(--font-mono)" fontSize={10} fill="var(--text-muted)" textAnchor="middle">
        {`Ring z=${ringTeeth}  Pinion z=${pinionTeeth}  i=${ratio.toFixed(2)}`}
      </text>
    </svg>
  );
}
