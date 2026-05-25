// CAD-style detail view showing how kerf offset is applied to outer profile and bore

interface Props { kerf: number; moduleMm: number; }

const W = 232, H = 170;
const TOOTH_H = 80;
// Tooth proportions are module-normalized: they derive from fixed TOOTH_H, so the tooth
// always looks the same visually regardless of module (only kv scale changes)
const ROOT_H = (Math.PI * TOOTH_H * 0.52) / (2 * 2.25); // ≈ 29 px
const TIP_H  = (Math.PI * TOOTH_H * 0.28) / (2 * 2.25); // ≈ 16 px
const FONT   = 'var(--font-mono)';

// Inward-facing arrowhead: dir 1 = tip points right, dir -1 = tip points left
function ah(x: number, y: number, dir: 1 | -1): string {
  const xb = (x - dir * 3.5).toFixed(1);
  return `${x.toFixed(1)},${y.toFixed(1)} ${xb},${(y - 2).toFixed(1)} ${xb},${(y + 2).toFixed(1)}`;
}

export function KerfDetailView({ kerf, moduleMm }: Props) {
  const s   = TOOTH_H / (2.25 * moduleMm);          // px per mm at this module
  const kv  = Math.min(Math.max(kerf * s, 3.5), TIP_H - 2); // visual px, min 3.5
  const lab = kerf.toFixed(2);
  const scN = Math.round(s);

  // Tooth trapezoid (left panel, centered at bx)
  const bx = 66, by = 136;
  const orig: [number, number][] = [
    [bx - ROOT_H, by], [bx - TIP_H,  by - TOOTH_H],
    [bx + TIP_H,  by - TOOTH_H], [bx + ROOT_H, by],
  ];
  const comp: [number, number][] = [
    [bx - ROOT_H + kv, by], [bx - TIP_H  + kv, by - TOOTH_H + kv],
    [bx + TIP_H  - kv, by - TOOTH_H + kv], [bx + ROOT_H - kv, by],
  ];
  const pts = (arr: [number, number][]) =>
    arr.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ' Z';

  // Right-flank dimension line
  const ay = by - TOOTH_H * 0.48;
  const xO = orig[3]![0], xC = comp[3]![0];

  // Bore arc (right panel)
  const bcx = 183, bcy = 80, R0 = 17, R1 = R0 + kv;
  const bArc = (R: number) =>
    `M ${bcx},${(bcy - R).toFixed(1)} A ${R.toFixed(1)},${R.toFixed(1)} 0 0 1 ${bcx},${(bcy + R).toFixed(1)}`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
         style={{ display: 'block', filter: 'drop-shadow(0 3px 12px rgba(10,12,16,.14))' }}>

      <rect x={.5} y={.5} width={W - 1} height={H - 1} rx={9.5}
            fill="white" stroke="#e60023" strokeWidth={1} />

      {/* Header */}
      <text x={10} y={15} fontFamily={FONT} fontSize={8.5} fontWeight={600}
            letterSpacing="0.09em" fill="#52545a">DETALLE A</text>
      <text x={W - 10} y={15} fontFamily={FONT} fontSize={8} textAnchor="end"
            fill="#9aa0a6">× {scN}:1</text>
      <line x1={8} y1={20} x2={W - 8} y2={20} stroke="#e8eaed" strokeWidth={.5} />

      {/* Panel divider */}
      <line x1={136} y1={22} x2={136} y2={H - 22} stroke="#e8eaed" strokeWidth={.5} />

      {/* ── Left: Tooth profile ── */}
      {/* Root construction line */}
      <line x1={8} y1={by} x2={130} y2={by} stroke="#d1d5db" strokeWidth={.5} strokeDasharray="2,3" />
      {/* Original */}
      <path d={pts(orig)} fill="none" stroke="#9aa0a6" strokeWidth={1} strokeDasharray="3,2" />
      {/* Compensated */}
      <path d={pts(comp)} fill="rgba(230,0,35,.06)" stroke="#e60023" strokeWidth={1.5} />

      {/* Right-flank dimension */}
      <line x1={xO} y1={ay - 5} x2={xO} y2={ay + 5} stroke="#9aa0a6" strokeWidth={.7} />
      <line x1={xC} y1={ay - 5} x2={xC} y2={ay + 5} stroke="#e60023" strokeWidth={.7} />
      <line x1={xO} y1={ay} x2={xC} y2={ay} stroke="#1a1c1f" strokeWidth={.8} />
      <polygon points={ah(xO, ay, -1)} fill="#1a1c1f" />
      <polygon points={ah(xC, ay,  1)} fill="#1a1c1f" />
      <text x={(xO + xC) / 2} y={ay - 8} fontFamily={FONT} fontSize={8}
            textAnchor="middle" fill="#1a1c1f">−{lab} mm</text>

      <text x={bx} y={H - 28} fontFamily={FONT} fontSize={7.5} letterSpacing="0.07em"
            textAnchor="middle" fill="#9aa0a6">DIENTE</text>

      {/* ── Right: Bore detail ── */}
      {/* Center mark + radial line */}
      <line x1={bcx - 5} y1={bcy} x2={bcx + R1 + 6} y2={bcy}
            stroke="#d1d5db" strokeWidth={.5} />
      <circle cx={bcx} cy={bcy} r={1.5} fill="#c8d0da" />
      {/* Original bore arc */}
      <path d={bArc(R0)} fill="none" stroke="#9aa0a6" strokeWidth={1} strokeDasharray="3,2" />
      {/* Compensated bore arc */}
      <path d={bArc(R1)} fill="none" stroke="#e60023" strokeWidth={1.5} />

      {/* Radial dimension */}
      <line x1={bcx + R0} y1={bcy} x2={bcx + R1} y2={bcy} stroke="#1a1c1f" strokeWidth={.8} />
      <polygon points={ah(bcx + R0, bcy,  1)} fill="#1a1c1f" />
      <polygon points={ah(bcx + R1, bcy, -1)} fill="#1a1c1f" />
      <text x={(bcx + R0 + bcx + R1) / 2} y={bcy - 7} fontFamily={FONT} fontSize={8}
            textAnchor="middle" fill="#1a1c1f">+{lab} mm</text>

      <text x={bcx} y={H - 28} fontFamily={FONT} fontSize={7.5} letterSpacing="0.07em"
            textAnchor="middle" fill="#9aa0a6">AGUJERO</text>

      {/* Legend */}
      <line x1={8} y1={H - 20} x2={W - 8} y2={H - 20} stroke="#e8eaed" strokeWidth={.5} />
      <line x1={10} y1={H - 11} x2={22} y2={H - 11} stroke="#9aa0a6" strokeWidth={1} strokeDasharray="3,2" />
      <text x={26} y={H - 8} fontFamily={FONT} fontSize={7.5} fill="#9aa0a6">original</text>
      <line x1={84} y1={H - 11} x2={96} y2={H - 11} stroke="#e60023" strokeWidth={1.5} />
      <text x={100} y={H - 8} fontFamily={FONT} fontSize={7.5} fill="#9aa0a6">compensado</text>
    </svg>
  );
}
