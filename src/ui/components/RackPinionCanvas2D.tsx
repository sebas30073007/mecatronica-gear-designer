import { useMemo, useEffect, useRef } from 'react';
import { generateSpurGearOutline } from '../../geometry/spurGear2D';
import { toLocalSvgPath } from '../../geometry/polar';
import type { UnitSystem } from '../../core/gearTypes';

const SVG_W = 620, SVG_H = 420;
const R2D = 180 / Math.PI;
const OMEGA = (2 * Math.PI) / 18; // display speed rad/s

interface Props {
  pinionTeeth: number;
  moduleMm: number;
  pressureAngleDeg: number;
  rackLengthMm: number;
  unitSystem: UnitSystem;
}

/** Generates the full rack SVG path (body + teeth). rack pitch line at pitchY. */
function rackSvgPath(
  left: number, right: number,
  pitchY: number,
  pitch: number, add: number, ded: number,
  offset: number, pa = 20,
): string {
  const tan = Math.tan(pa * Math.PI / 180);
  const halfTip = pitch / 4 - add * tan;
  const halfDed = pitch / 4 + ded * tan;
  const yTip  = pitchY - add;
  const yDed  = pitchY + ded;
  const yBase = pitchY + ded + add * 2.5;

  const seg: string[] = [];
  const k0 = Math.ceil((left - halfDed - offset) / pitch);
  const kN = Math.floor((right + halfDed - offset) / pitch);

  seg.push(`L ${right} ${yDed}`);
  for (let k = kN; k >= k0; k--) {
    const tc = offset + k * pitch;
    // Only draw teeth fully within the rack bounds to avoid edge artifacts
    if (tc - halfDed < left || tc + halfDed > right) continue;
    const rd = tc + halfDed;
    const rt = tc + halfTip;
    const lt = tc - halfTip;
    const ld = tc - halfDed;
    seg.push(`L ${rd.toFixed(1)} ${yDed}`);
    if (halfTip > 0) {
      seg.push(`L ${rt.toFixed(1)} ${yTip.toFixed(1)}`);
      seg.push(`L ${lt.toFixed(1)} ${yTip.toFixed(1)}`);
    } else {
      seg.push(`L ${tc.toFixed(1)} ${yTip.toFixed(1)}`);
    }
    seg.push(`L ${ld.toFixed(1)} ${yDed}`);
  }
  seg.push(`L ${left} ${yDed}`);

  return (
    `M ${left} ${yBase} L ${right} ${yBase} ` +
    seg.join(' ') +
    ` Z`
  );
}

/** Phase offset so the nearest tooth gap faces downward (+Y in SVG) for any tooth count. */
function gapPhaseOffset(teeth: number): number {
  const pitchDeg = 360 / teeth;
  const k = Math.round(90 / pitchDeg - 0.5);
  return 90 - (k + 0.5) * pitchDeg;
}

export default function RackPinionCanvas2D({
  pinionTeeth, moduleMm, pressureAngleDeg, rackLengthMm,
}: Props) {
  // Scale: pinion pitch radius → ~80px
  const R_mm    = (pinionTeeth * moduleMm) / 2;
  const scale   = Math.min(80 / R_mm, 3.5);
  const R_disp  = R_mm * scale;

  const pinCX = SVG_W / 2 - 30;
  const pinCY = SVG_H / 2 - R_disp * 0.3;

  const rackCY = pinCY + R_disp;           // rack pitch line Y
  const rackLeft  = Math.max(pinCX - rackLengthMm * scale / 2, 12);
  const rackRight = Math.min(pinCX + rackLengthMm * scale / 2, SVG_W - 12);
  const rackWidth = rackRight - rackLeft;

  const pitch = Math.PI * moduleMm * scale;
  const add   = moduleMm * scale;
  const ded   = 1.25 * moduleMm * scale;

  // Clip rect for rack (prevents partial teeth from appearing outside the body)
  const yTip  = rackCY - add;
  const yBase = rackCY + ded + add * 2.5;

  // Max oscillation: rack can travel ±halfWidth before going off screen
  const maxTravel = (rackWidth / 2) - R_disp * 0.6;

  // Phase offset so the pinion starts with a gap facing the rack (downward)
  const phaseOffset = gapPhaseOffset(pinionTeeth);

  const geo = useMemo(
    () => generateSpurGearOutline({ teeth: pinionTeeth, moduleMm, pressureAngleDeg }),
    [pinionTeeth, moduleMm, pressureAngleDeg],
  );
  const localPath = useMemo(() => toLocalSvgPath(geo.outline, scale), [geo.outline, scale]);

  const pinRef    = useRef<SVGGElement>(null);
  const rackRef   = useRef<SVGPathElement>(null);
  const live      = useRef({
    pinionTeeth, moduleMm, scale, R_disp, pitch, add, ded,
    pinCX, rackCY, rackLeft, rackRight, maxTravel, pressureAngleDeg, phaseOffset,
  });
  live.current = {
    pinionTeeth, moduleMm, scale, R_disp, pitch, add, ded,
    pinCX, rackCY, rackLeft, rackRight, maxTravel, pressureAngleDeg, phaseOffset,
  };

  useEffect(() => {
    let rafId: number, t0 = 0;
    const frame = (now: DOMHighResTimeStamp) => {
      if (!t0) t0 = now;
      const el = (now - t0) / 1000;
      const {
        R_disp: R, pitch: p, add: a, ded: d,
        pinCX: cx, rackCY: ry, rackLeft: rl, rackRight: rr,
        maxTravel: mt, pressureAngleDeg: pa, phaseOffset: po,
      } = live.current;

      // Sinusoidal rack motion
      const phase  = el * OMEGA * 0.6;
      const offset = cx + Math.sin(phase) * mt;      // rack tooth-pattern offset
      const pinDeg = -(offset - cx) / R * R2D;       // pinion rotation degrees

      pinRef.current?.setAttribute('transform', `rotate(${(pinDeg + po).toFixed(3)})`);
      const d_path = rackSvgPath(rl, rr, ry, p, a, d, offset, pa);
      rackRef.current?.setAttribute('d', d_path);

      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
      <defs>
        <clipPath id="rp2d-rack-clip">
          <rect x={rackLeft} y={yTip - 1} width={rackWidth} height={yBase - yTip + 2} />
        </clipPath>
      </defs>

      {/* Pitch line */}
      <line x1={rackLeft} y1={rackCY} x2={rackRight} y2={rackCY}
        stroke="var(--red)" strokeWidth={0.6} strokeDasharray="3 4" opacity={0.4} />

      {/* Axis line from pinion to rack */}
      <line x1={pinCX} y1={pinCY} x2={pinCX} y2={rackCY}
        stroke="var(--text-muted)" strokeWidth={0.8} strokeDasharray="3 3" opacity={0.35} />

      {/* Rack — clipped to its bounding rect so partial teeth at edges are clean */}
      <path ref={rackRef} clipPath="url(#rp2d-rack-clip)"
        fill="var(--white)" stroke="var(--black)" strokeWidth={1.5}
        strokeLinejoin="round" strokeLinecap="round" />

      {/* Pitch circle of pinion */}
      <circle cx={pinCX} cy={pinCY} r={R_disp}
        fill="none" stroke="var(--red)" strokeWidth={0.75} strokeDasharray="3 4" opacity={0.35} />

      {/* Pinion */}
      <g transform={`translate(${pinCX}, ${pinCY})`}>
        <g ref={pinRef}>
          <path d={localPath} fill="var(--white)" stroke="var(--black)"
            strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        </g>
        <circle r={3.5} fill="var(--red)" />
      </g>

      {/* Annotations */}
      <text x={pinCX + R_disp + 8} y={pinCY}
        fontFamily="var(--font-mono)" fontSize={10} fill="var(--text-muted)"
        dominantBaseline="middle">
        z={pinionTeeth}
      </text>
      <text x={pinCX} y={yBase + add * 1.5}
        fontFamily="var(--font-mono)" fontSize={10} fill="var(--text-muted)"
        textAnchor="middle">
        L = {rackLengthMm} mm
      </text>
    </svg>
  );
}
