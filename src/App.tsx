import { useState } from 'react';
import { useGearStore } from './state/useGearStore';
import { pitchDiameter, externalCenterDistance } from './core/gearMath';
import { gearRatio } from './core/gearRatios';
import { validateGearPair } from './core/validation';
import type { SpurGear, ActiveMode, ViewMode } from './core/gearTypes';
import { is3dOnly } from './core/gearTypes';
import TopBar from './ui/components/TopBar';
import LeftPanel from './ui/components/LeftPanel';
import GearCanvas from './ui/components/GearCanvas';
import ExportModal from './ui/components/ExportModal';
import './styles/global.css';

export default function App() {
  const [debug, setDebug]           = useState(false);
  const [showRuler, setShowRuler]   = useState(false);
  const [showExport, setShowExport] = useState(false);

  const {
    gears, setTeeth, setModule, setPressureAngle,
    view, unitSystem, activeMode,
    setViewMode, setUnitSystem, setActiveMode,
    fabricationMode, fab3d,
    setFabricationMode, setFab3d,
  } = useGearStore();

  const g1 = gears[0] as SpurGear;
  const g2 = gears[1] as SpurGear;
  if (!g1 || !g2) return null;

  const moduleMm   = g1.moduleMm;
  const pa         = g1.pressureAngleDeg;
  const d1         = pitchDiameter(moduleMm, g1.teeth);
  const d2         = pitchDiameter(moduleMm, g2.teeth);
  const centerDist = externalCenterDistance(d1, d2);
  const ratio      = gearRatio(g2.teeth, g1.teeth);
  const warnings   = validateGearPair(g1.teeth, g2.teeth, moduleMm);
  if (ratio > 10) warnings.push({ code: 'RATIO_HIGH', message: 'Reducción > 10:1 — considerar tren compuesto.', severity: 'warn' });

  const is3d      = view.mode === '3d';
  const canToggle = !is3dOnly(activeMode);

  const handleSetActiveMode = (mode: ActiveMode) => {
    setActiveMode(mode);
    if (is3dOnly(mode)) setViewMode('3d' as ViewMode);
  };

  return (
    <div className={`app${showExport ? ' app-frozen' : ''}`}>
      <TopBar
        debug={debug} showRuler={showRuler}
        onDebugToggle={() => setDebug(v => !v)}
        onRulerToggle={() => setShowRuler(v => !v)}
        onExportClick={() => setShowExport(true)}
      />
      <LeftPanel
        g1={g1} g2={g2} ratio={ratio} centerDist={centerDist}
        moduleMm={moduleMm} pa={pa} unitSystem={unitSystem} activeMode={activeMode}
        warnings={warnings}
        fabricationMode={fabricationMode} fab3d={fab3d}
        onSetTeeth={setTeeth} onSetModule={setModule}
        onSetPressureAngle={setPressureAngle} onSetUnitSystem={setUnitSystem}
        onSetActiveMode={handleSetActiveMode}
        onSetFabricationMode={setFabricationMode} onSetFab3d={setFab3d}
      />
      {canToggle && (
        <div className="view-toggle">
          <button className={!is3d ? 'active' : ''} onClick={() => setViewMode('2d' as ViewMode)}>2D</button>
          <button className={ is3d ? 'active' : ''} onClick={() => setViewMode('3d' as ViewMode)}>3D</button>
        </div>
      )}
      <GearCanvas
        g1={g1} g2={g2} moduleMm={moduleMm} pa={pa} ratio={ratio}
        unitSystem={unitSystem} debug={debug} showRuler={showRuler}
        is3d={is3d} activeMode={activeMode}
      />
      {showExport && (
        <ExportModal
          g1={g1} g2={g2} moduleMm={moduleMm} pa={pa}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
