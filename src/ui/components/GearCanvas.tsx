import type { SpurGear, UnitSystem, ActiveMode, RackPinionParams, InternalGearParams, PlanetaryParams, HelicalParams, WormParams, BevelParams } from '../../core/gearTypes';
import { fmtModule } from '../../core/units';
import StaticGearPreview from './StaticGearPreview';
import GearCanvas3D from './GearCanvas3D';
import RackPinionCanvas3D from './RackPinionCanvas3D';
import InternalGearCanvas3D from './InternalGearCanvas3D';
import PlanetaryCanvas3D from './PlanetaryCanvas3D';
import HelicalGearCanvas3D from './HelicalGearCanvas3D';
import HerringboneGearCanvas3D from './HerringboneGearCanvas3D';
import WormGearCanvas3D from './WormGearCanvas3D';
import BevelGearCanvas3D from './BevelGearCanvas3D';

const LIVE_MODES: ActiveMode[] = ['simple', 'rack-pinion', 'internal', 'planetary', 'helical', 'herringbone', 'worm', 'bevel'];

interface Props {
  g1: SpurGear; g2: SpurGear; moduleMm: number; pa: number; ratio: number;
  unitSystem: UnitSystem; is3d: boolean;
  activeMode: ActiveMode;
  rackPinion: RackPinionParams;
  internalGear: InternalGearParams;
  planetary: PlanetaryParams;
  helical: HelicalParams;
  herringbone: HelicalParams;
  worm: WormParams;
  bevel: BevelParams;
}

export default function GearCanvas({
  g1, g2, moduleMm, pa, ratio, unitSystem, is3d, activeMode, rackPinion, internalGear, planetary, helical, herringbone, worm, bevel,
}: Props) {
  const isLive = LIVE_MODES.includes(activeMode);
  const viewMode = is3d ? '3d' : '2d';

  return (
    <section className={`stage${isLive ? ' stage--three' : ''}`} aria-label="Gear preview">

      {/* Annotations — visible only for simple spur gear */}
      {isLive && activeMode === 'simple' && (
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

      {/* ── Unified Three.js canvases — 2D mode = front camera, 3D mode = iso ── */}
      {activeMode === 'simple' &&
        <GearCanvas3D g1={g1} g2={g2} moduleMm={moduleMm} pa={pa} viewMode={viewMode} />}

      {activeMode === 'rack-pinion' &&
        <RackPinionCanvas3D {...rackPinion} viewMode={viewMode} />}

      {activeMode === 'internal' &&
        <InternalGearCanvas3D {...internalGear} viewMode={viewMode} />}

      {activeMode === 'planetary' &&
        <PlanetaryCanvas3D {...planetary} viewMode={viewMode} />}

      {activeMode === 'helical' &&
        <HelicalGearCanvas3D {...helical} />}

      {activeMode === 'herringbone' &&
        <HerringboneGearCanvas3D {...herringbone} />}

      {activeMode === 'worm' &&
        <WormGearCanvas3D {...worm} />}

      {activeMode === 'bevel' &&
        <BevelGearCanvas3D {...bevel} />}

      {/* Placeholder for modes without a live canvas yet */}
      {!isLive && <StaticGearPreview activeMode={activeMode} is3d={is3d} />}

    </section>
  );
}
