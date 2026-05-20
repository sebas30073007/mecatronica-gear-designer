import type { UnitSystem } from '../../core/gearTypes';
import type { SpurGearGeometry } from '../../geometry/spurGear2D';
import { fmtLength } from '../../core/units';

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

interface Props {
  cx1: number; cy1: number; cx2: number; cy2: number;
  geo1: SpurGearGeometry; geo2: SpurGearGeometry;
  svgScale: number; unitSystem: UnitSystem;
}

export default function DimensionOverlay({ cx1, cy1, cx2, cy2, geo1, geo2, svgScale, unitSystem }: Props) {
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
