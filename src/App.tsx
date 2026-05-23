import { useState } from 'react';
import { useGearStore } from './state/useGearStore';
import { gearRatio } from './core/gearRatios';
import { validateGearPair } from './core/validation';
import type { SpurGear, ActiveMode, ViewMode } from './core/gearTypes';
import { is3dOnly } from './core/gearTypes';
import TopBar from './ui/components/TopBar';
import ToolRibbon from './ui/components/ToolRibbon';
import GearCanvas from './ui/components/GearCanvas';
import ExportModal from './ui/components/ExportModal';
import './styles/global.css';

export default function App() {
  const [showExport, setShowExport] = useState(false);

  const {
    gears, setTeeth, setModule, setPressureAngle, setThickness,
    view, unitSystem, activeMode,
    setViewMode, setUnitSystem, setActiveMode,
    rackPinion, setRackPinion,
    internalGear, setInternalGear,
    planetary, setPlanetary,
    helical, setHelical,
    herringbone, setHerringbone,
  } = useGearStore();

  const g1 = gears[0] as SpurGear;
  const g2 = gears[1] as SpurGear;
  if (!g1 || !g2) return null;

  const moduleMm = g1.moduleMm;
  const pa       = g1.pressureAngleDeg;
  const ratio    = gearRatio(g2.teeth, g1.teeth);
  const warnings = validateGearPair(g1.teeth, g2.teeth, moduleMm);
  if (ratio > 10) warnings.push({ code: 'RATIO_HIGH', message: 'Reducción > 10:1 — considerar tren compuesto.', severity: 'warn' });

  const is3d      = view.mode === '3d';
  const canToggle = !is3dOnly(activeMode);

  const faceWidthMm = (() => {
    switch (activeMode) {
      case 'rack-pinion': return rackPinion.thicknessMm;
      case 'internal':    return internalGear.thicknessMm;
      case 'planetary':   return planetary.thicknessMm;
      case 'helical':      return helical.thicknessMm;
      case 'herringbone':  return herringbone.thicknessMm;
      default:             return g1.thicknessMm;
    }
  })();

  const handleSetFaceWidth = (mm: number) => {
    switch (activeMode) {
      case 'rack-pinion': setRackPinion({ thicknessMm: mm }); break;
      case 'internal':    setInternalGear({ thicknessMm: mm }); break;
      case 'planetary':   setPlanetary({ thicknessMm: mm }); break;
      case 'helical':     setHelical({ thicknessMm: mm }); break;
      case 'herringbone': setHerringbone({ thicknessMm: mm }); break;
      default:            setThickness(mm); break;
    }
  };

  const designSummary = (() => {
    const fmtM = (m: number) => `m${Number.isInteger(m) ? m : m.toFixed(2)}`;
    switch (activeMode) {
      case 'simple':
        return `Spur Gear · z${g1.teeth}/z${g2.teeth} · i=${ratio.toFixed(2)} · ${fmtM(moduleMm)}`;
      case 'rack-pinion':
        return `Rack & Pinion · z${rackPinion.pinionTeeth} · L=${rackPinion.rackLengthMm}mm · ${fmtM(rackPinion.moduleMm)}`;
      case 'internal': {
        const iRatio = internalGear.ringTeeth / internalGear.pinionTeeth;
        return `Internal Gear · Ring z${internalGear.ringTeeth} / Pin z${internalGear.pinionTeeth} · i=${iRatio.toFixed(2)} · ${fmtM(internalGear.moduleMm)}`;
      }
      case 'planetary':   return 'Planetary Gear Set';
      case 'compound':    return 'Compound Gear Train';
      case 'helical':     return 'Helical Gear';
      case 'bevel':       return 'Bevel Gear';
      case 'herringbone': return 'Herringbone Gear';
      default:            return 'Gear Designer';
    }
  })();

  const handleSetActiveMode = (mode: ActiveMode) => {
    setActiveMode(mode);
    if (is3dOnly(mode)) setViewMode('3d' as ViewMode);
  };

  return (
    <div className={`app${showExport ? ' app-frozen' : ''}`}>
      <TopBar summary={designSummary} />

      <ToolRibbon
        g1={g1} g2={g2}
        moduleMm={moduleMm} pa={pa} unitSystem={unitSystem} activeMode={activeMode}
        warnings={warnings} is3d={is3d}
        faceWidthMm={faceWidthMm} onSetFaceWidth={handleSetFaceWidth}
        rackPinion={rackPinion} internalGear={internalGear} planetary={planetary}
        onSetTeeth={setTeeth} onSetModule={setModule}
        onSetPressureAngle={setPressureAngle} onSetUnitSystem={setUnitSystem}
        onSetActiveMode={handleSetActiveMode}
        onSetRackPinion={setRackPinion} onSetInternalGear={setInternalGear}
        onSetPlanetary={setPlanetary}
        helical={helical} onSetHelical={setHelical}
        herringbone={herringbone} onSetHerringbone={setHerringbone}
        onExportClick={() => setShowExport(true)}
      />

      {canToggle && (
        <div className="view-toggle">
          <button className={!is3d ? 'active' : ''} onClick={() => setViewMode('2d' as ViewMode)}>2D</button>
          <button className={ is3d ? 'active' : ''} onClick={() => setViewMode('3d' as ViewMode)}>3D</button>
        </div>
      )}

      <GearCanvas
        g1={g1} g2={g2} moduleMm={moduleMm} pa={pa} ratio={ratio}
        unitSystem={unitSystem} is3d={is3d} activeMode={activeMode}
        rackPinion={rackPinion} internalGear={internalGear} planetary={planetary}
        helical={helical}
      />

      {showExport && (
        <ExportModal
          g1={g1} g2={g2} moduleMm={moduleMm} pa={pa}
          is3d={is3d}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
