import type { ActiveMode } from '../../core/gearTypes';

const W = 620, H = 420;

function gearPath(cx: number, cy: number, r: number, teeth: number, h: number): string {
  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 0.28) / teeth) * Math.PI * 2 - Math.PI / 2;
    const a2 = ((i + 0.72) / teeth) * Math.PI * 2 - Math.PI / 2;
    const a3 = ((i + 1)    / teeth) * Math.PI * 2 - Math.PI / 2;
    const c = Math.cos, s = Math.sin;
    pts.push(`${(cx + r * c(a0)).toFixed(1)},${(cy + r * s(a0)).toFixed(1)}`);
    pts.push(`${(cx + (r+h) * c(a1)).toFixed(1)},${(cy + (r+h) * s(a1)).toFixed(1)}`);
    pts.push(`${(cx + (r+h) * c(a2)).toFixed(1)},${(cy + (r+h) * s(a2)).toFixed(1)}`);
    pts.push(`${(cx + r * c(a3)).toFixed(1)},${(cy + r * s(a3)).toFixed(1)}`);
  }
  return 'M ' + pts.join(' L ') + ' Z';
}

function Gear({ cx, cy, r, teeth, h = 10, bore = 0 }: {
  cx: number; cy: number; r: number; teeth: number; h?: number; bore?: number;
}) {
  return (
    <g>
      <path d={gearPath(cx, cy, r, teeth, h)}
        fill="white" stroke="var(--text-strong)" strokeWidth={1.5} strokeLinejoin="round" />
      {bore > 0 && <circle cx={cx} cy={cy} r={bore} fill="var(--bg)" stroke="var(--text-strong)" strokeWidth={1.2} />}
      <circle cx={cx} cy={cy} r={3.5} fill="var(--red)" />
    </g>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <text x={W / 2} y={H - 22} textAnchor="middle"
      fontFamily="var(--font-mono)" fontSize={11} fontWeight={600}
      letterSpacing="0.1em" fill="var(--text-muted)">
      {label.toUpperCase()}
    </text>
  );
}

function PitchCircle({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--red)"
    strokeWidth={0.75} strokeDasharray="3 4" opacity={0.35} />;
}

function AxisLine({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2}
    stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="4 4" opacity={0.4} />;
}

function SimplePreview({ is3d }: { is3d: boolean }) {
  const cx1 = 225, cy1 = 210, cx2 = 395, cy2 = 210;
  return (
    <>
      <AxisLine x1={cx2} y1={cy2} x2={cx1} y2={cy1} />
      <Gear cx={cx1} cy={cy1} r={82} teeth={18} h={12} bore={12} />
      <Gear cx={cx2} cy={cy2} r={41} teeth={9}  h={12} bore={8} />
      <PitchCircle cx={cx1} cy={cy1} r={82} />
      <PitchCircle cx={cx2} cy={cy2} r={41} />
      <Badge label={is3d ? '3D Preview — Three.js rendering in development' : 'Simple Gear Train'} />
    </>
  );
}

function PlanetaryPreview() {
  const cx = 310, cy = 210, rSun = 42, rPlanet = 25, orbit = 90;
  const planets = [0, 1, 2].map(i => ({
    px: cx + orbit * Math.cos((i / 3) * Math.PI * 2 - Math.PI / 2),
    py: cy + orbit * Math.sin((i / 3) * Math.PI * 2 - Math.PI / 2),
  }));
  return (
    <>
      <circle cx={cx} cy={cy} r={rSun + rPlanet + orbit + 8}
        fill="none" stroke="var(--text-strong)" strokeWidth={18} opacity={0.08} />
      <circle cx={cx} cy={cy} r={rSun + rPlanet + orbit + 8}
        fill="none" stroke="var(--text-strong)" strokeWidth={1.5} />
      {planets.map((p, i) => (
        <g key={i}>
          <AxisLine x1={cx} y1={cy} x2={p.px} y2={p.py} />
          <Gear cx={p.px} cy={p.py} r={rPlanet} teeth={8} h={7} />
        </g>
      ))}
      <Gear cx={cx} cy={cy} r={rSun} teeth={12} h={8} bore={10} />
      <Badge label="Planetary (Epicyclic)" />
    </>
  );
}

function InternalPreview() {
  const cx = 310, cy = 210, rRing = 135, rPinion = 50;
  return (
    <>
      <circle cx={cx} cy={cy} r={rRing + 14}
        fill="white" stroke="var(--text-strong)" strokeWidth={1.5} />
      <path d={gearPath(cx, cy, rRing, 30, -12)}
        fill="var(--bg)" stroke="var(--text-strong)" strokeWidth={1.4} strokeLinejoin="round" />
      <Gear cx={cx - rRing + rPinion + 6} cy={cy} r={rPinion} teeth={12} h={9} bore={8} />
      <circle cx={cx} cy={cy} r={3} fill="var(--red)" opacity={0.4} />
      <Badge label="Internal Gear (Ring)" />
    </>
  );
}

function RackPinionPreview() {
  const gearCx = 230, gearCy = 170, r = 68, teeth = 16;
  const rackY = gearCy + r + 2, rackX1 = 60, rackX2 = 560, rackH = 22, tW = 34;
  const rackPts: string[] = [];
  for (let i = 0; i * tW < rackX2 - rackX1; i++) {
    const x = rackX1 + i * tW;
    rackPts.push(`${x},${rackY} ${x + tW * 0.2},${rackY - rackH} ${x + tW * 0.8},${rackY - rackH} ${x + tW},${rackY}`);
  }
  return (
    <>
      <AxisLine x1={gearCx} y1={gearCy} x2={gearCx} y2={rackY} />
      <rect x={rackX1} y={rackY} width={rackX2 - rackX1} height={rackH + 16}
        fill="white" stroke="var(--text-strong)" strokeWidth={1.5} />
      {rackPts.map((pts, i) => (
        <polygon key={i} points={pts} fill="var(--bg)" stroke="var(--text-strong)" strokeWidth={1} />
      ))}
      <Gear cx={gearCx} cy={gearCy} r={r} teeth={teeth} h={10} bore={10} />
      <PitchCircle cx={gearCx} cy={gearCy} r={r} />
      <Badge label="Rack & Pinion" />
    </>
  );
}

function CompoundPreview() {
  const cx1 = 220, cy1 = 210, cx2 = 420, cy2 = 210;
  return (
    <>
      <AxisLine x1={cx1} y1={cy1} x2={cx2} y2={cy2} />
      <line x1={cx1} y1={cy1 - 95} x2={cx1} y2={cy1 + 95}
        stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="5 3" opacity={0.5} />
      <Gear cx={cx1} cy={cy1} r={90} teeth={20} h={12} bore={12} />
      <Gear cx={cx1} cy={cy1} r={40} teeth={10} h={10} bore={12} />
      <Gear cx={cx2} cy={cy2} r={55} teeth={14} h={10} bore={8} />
      <PitchCircle cx={cx1} cy={cy1} r={90} />
      <PitchCircle cx={cx2} cy={cy2} r={55} />
      <Badge label="Compound Gear Train — 3D Only" />
    </>
  );
}

function HelicalPreview() {
  const cx1 = 225, cy1 = 210, cx2 = 395, cy2 = 210;
  const helixLines = [-30, -15, 0, 15, 30].map(offset => ({
    x1: cx1 - 82 + offset, y1: cy1 - 82,
    x2: cx1 - 82 + offset + 20, y2: cy1 + 82,
  }));
  return (
    <>
      <AxisLine x1={cx2} y1={cy2} x2={cx1} y2={cy1} />
      <Gear cx={cx1} cy={cy1} r={82} teeth={18} h={12} bore={12} />
      <Gear cx={cx2} cy={cy2} r={41} teeth={9}  h={12} bore={8} />
      <g clipPath="url(#gear1clip)" opacity={0.4}>
        {helixLines.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke="var(--red)" strokeWidth={1.2} />
        ))}
      </g>
      <clipPath id="gear1clip">
        <circle cx={cx1} cy={cy1} r={94} />
      </clipPath>
      <Badge label="Helical Gear Pair — 3D Only" />
    </>
  );
}

function BevelPreview() {
  const cx1 = 240, cy1 = 200, cx2 = 380, cy2 = 310;
  return (
    <>
      <line x1={cx1} y1={cy1} x2={cx2} y2={cy2}
        stroke="var(--text-muted)" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.5} />
      <Gear cx={cx1} cy={cy1} r={78} teeth={16} h={11} bore={10} />
      <Gear cx={cx2} cy={cy2} r={78} teeth={16} h={11} bore={10} />
      <text x={W / 2} y={H - 40} textAnchor="middle"
        fontFamily="var(--font-mono)" fontSize={10} fill="var(--text-muted)" opacity={0.7}>
        90°
      </text>
      <Badge label="Bevel (Conic) Gear — 3D Only" />
    </>
  );
}

function HerringbonePreview() {
  const cx1 = 225, cy1 = 210, cx2 = 395, cy2 = 210;
  const vLines = [-25, -10, 5, 20, 35].map(offset => ({
    x: cx1 + offset,
  }));
  return (
    <>
      <AxisLine x1={cx2} y1={cy2} x2={cx1} y2={cy1} />
      <Gear cx={cx1} cy={cy1} r={82} teeth={18} h={12} bore={12} />
      <Gear cx={cx2} cy={cy2} r={41} teeth={9}  h={12} bore={8} />
      <g opacity={0.35}>
        {vLines.map((l, i) => (
          <g key={i}>
            <line x1={l.x - 10} y1={cy1 - 70} x2={l.x}     y2={cy1}
              stroke="var(--red)" strokeWidth={1.2} />
            <line x1={l.x}      y1={cy1}        x2={l.x - 10} y2={cy1 + 70}
              stroke="var(--red)" strokeWidth={1.2} />
          </g>
        ))}
      </g>
      <Badge label="Herringbone (Double Helical) — 3D Only" />
    </>
  );
}

function WormPreview() {
  const wxL = 130, wxR = 490, wY1 = 155, wY2 = 205; // worm band
  const cx = 310, cy = 320, r = 75;                   // wheel center
  const helixLines = [-60, -40, -20, 0, 20, 40, 60].map(dx => ({ dx }));
  return (
    <>
      {/* Worm shaft */}
      <rect x={wxL} y={wY1} width={wxR - wxL} height={wY2 - wY1} rx={20}
        fill="var(--bg)" stroke="var(--red)" strokeWidth={1.8} />
      {/* Helical thread lines on worm */}
      <clipPath id="worm-clip">
        <rect x={wxL + 1} y={wY1 + 1} width={wxR - wxL - 2} height={wY2 - wY1 - 2} rx={19} />
      </clipPath>
      <g clipPath="url(#worm-clip)" opacity={0.5}>
        {helixLines.map((l, i) => (
          <line key={i}
            x1={cx + l.dx - 15} y1={wY1}
            x2={cx + l.dx + 15} y2={wY2}
            stroke="var(--red)" strokeWidth={1.5} />
        ))}
      </g>
      {/* Worm wheel */}
      <Gear cx={cx} cy={cy} r={r} teeth={16} h={10} bore={10} />
      <Badge label="Worm Gear (Sin Fin) — 3D Only" />
    </>
  );
}

interface Props {
  activeMode: ActiveMode;
  is3d: boolean;
}

export default function StaticGearPreview({ activeMode, is3d }: Props) {
  const content = (() => {
    switch (activeMode) {
      case 'simple':     return <SimplePreview is3d={is3d} />;
      case 'planetary':  return <PlanetaryPreview />;
      case 'internal':   return <InternalPreview />;
      case 'rack-pinion':return <RackPinionPreview />;
      case 'compound':   return <CompoundPreview />;
      case 'helical':    return <HelicalPreview />;
      case 'bevel':      return <BevelPreview />;
      case 'herringbone':return <HerringbonePreview />;
      case 'worm':       return <WormPreview />;
    }
  })();

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ opacity: 0.88 }}>
      {content}
    </svg>
  );
}
