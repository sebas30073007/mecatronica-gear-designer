import type { UnitSystem } from '../../core/gearTypes';
import { MM_PER_INCH, SCALE_NICE_MM, SCALE_NICE_IN, nearestNice } from '../../core/units';

const SVG_W = 620;
const SVG_H = 420;

interface Props { svgScale: number; unitSystem: UnitSystem; }

export default function ScaleBar({ svgScale, unitSystem }: Props) {
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
