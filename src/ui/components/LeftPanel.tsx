import type { SpurGear, ActiveMode, UnitSystem, FabricationMode, FabricationState3D } from '../../core/gearTypes';
import type { ValidationWarning } from '../../core/validation';
import { fmtModule } from '../../core/units';
import TeethStepper from '../primitives/TeethStepper';
import RatioRow from '../primitives/RatioRow';
import CenterDistanceInput from '../primitives/CenterDistanceInput';
import GearTypeSelector from './GearTypeSelector';

const MODULES = [1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 4.0];

interface Props {
  g1: SpurGear;
  g2: SpurGear;
  ratio: number;
  centerDist: number;
  moduleMm: number;
  pa: number;
  unitSystem: UnitSystem;
  activeMode: ActiveMode;
  warnings: ValidationWarning[];
  fabricationMode: FabricationMode;
  fab3d: FabricationState3D;
  onSetTeeth: (id: string, teeth: number) => void;
  onSetModule: (m: number) => void;
  onSetPressureAngle: (deg: number) => void;
  onSetUnitSystem: (s: UnitSystem) => void;
  onSetActiveMode: (m: ActiveMode) => void;
  onSetFabricationMode: (m: FabricationMode) => void;
  onSetFab3d: (u: Partial<FabricationState3D>) => void;
}

function Num({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <section className="field">
      <h2 className="field-title">{label}</h2>
      <input className="text-input" type="number" min={min} max={max} step={step} value={value}
        onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) onChange(v); }} />
    </section>
  );
}

export default function LeftPanel({
  g1, g2, ratio, centerDist, moduleMm, pa, unitSystem, activeMode, warnings,
  fabricationMode, fab3d,
  onSetTeeth, onSetModule, onSetPressureAngle, onSetUnitSystem, onSetActiveMode,
  onSetFabricationMode, onSetFab3d,
}: Props) {
  return (
    <aside className="panel left-panel">

      {/* ── Gear design ─────────────────────────────── */}
      <section className="field">
        <h2 className="field-title">Type</h2>
        <GearTypeSelector value={activeMode} onChange={onSetActiveMode} />
      </section>

      <section className="field">
        <h2 className="field-title">Ratio Target</h2>
        <RatioRow ratio={ratio} teethIn={g2.teeth} onTeethOutChange={t => onSetTeeth(g1.id, t)} />
      </section>

      <section className="field">
        <h2 className="field-title">Teeth</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <TeethStepper label="Output" value={g1.teeth} onChange={v => onSetTeeth(g1.id, v)} />
          <TeethStepper label="Input"  value={g2.teeth} onChange={v => onSetTeeth(g2.id, v)} />
        </div>
      </section>

      <section className="field">
        <h2 className="field-title">Center Distance</h2>
        <CenterDistanceInput
          valueMm={centerDist} moduleMm={moduleMm} ratio={ratio} unitSystem={unitSystem}
          onTeethChange={(t1, t2) => { onSetTeeth(g1.id, t1); onSetTeeth(g2.id, t2); }}
        />
      </section>

      <section className="field">
        <h2 className="field-title">Module</h2>
        <div className="select-wrap">
          <select className="text-input" value={moduleMm}
            onChange={e => onSetModule(parseFloat(e.target.value))}>
            {MODULES.map(m => <option key={m} value={m}>{fmtModule(m, unitSystem)}</option>)}
          </select>
        </div>
      </section>

      <section className="field">
        <h2 className="field-title">Pressure Angle</h2>
        <div className="segmented cols-3">
          {([14.5, 20, 25] as const).map(deg => (
            <button key={deg} className={pa === deg ? 'active' : ''}
              onClick={() => onSetPressureAngle(deg)}>{deg}°</button>
          ))}
        </div>
      </section>

      <section className="field">
        <h2 className="field-title">Units</h2>
        <div className="segmented cols-2">
          <button className={unitSystem === 'metric'   ? 'active' : ''} onClick={() => onSetUnitSystem('metric')}>mm</button>
          <button className={unitSystem === 'imperial' ? 'active' : ''} onClick={() => onSetUnitSystem('imperial')}>in</button>
        </div>
      </section>

      {warnings.length > 0 && (
        <section className="field">
          {warnings.map((w, i) => (
            <div key={i} className={`warn-badge warn-${w.severity}`}>{w.message}</div>
          ))}
        </section>
      )}

      {/* ── Fabrication ─────────────────────────────── */}
      <div className="left-panel-divider" />

      <section className="field">
        <h2 className="field-title">Fabrication</h2>
        <div className="segmented cols-2">
          <button className={fabricationMode === '2d-laser' ? 'active' : ''}
            onClick={() => onSetFabricationMode('2d-laser')}>2D Laser</button>
          <button className={fabricationMode === '3d-print' ? 'active' : ''}
            onClick={() => onSetFabricationMode('3d-print')}>3D Print</button>
        </div>
      </section>

      {fabricationMode === '3d-print' && (
        <>
          <Num label="Face Width (mm)"   value={fab3d.faceWidthMm}    min={0.5} max={500} step={0.5} onChange={v => onSetFab3d({ faceWidthMm: v })} />
          <Num label="Bore Diameter (mm)" value={fab3d.boreDiameterMm} min={0.5} max={200} step={0.5} onChange={v => onSetFab3d({ boreDiameterMm: v })} />

          <section className="field">
            <h2 className="field-title">Hub</h2>
            <div className="segmented cols-2">
              <button className={!fab3d.hubEnabled ? 'active' : ''} onClick={() => onSetFab3d({ hubEnabled: false })}>Off</button>
              <button className={ fab3d.hubEnabled ? 'active' : ''} onClick={() => onSetFab3d({ hubEnabled: true  })}>On</button>
            </div>
          </section>

          {fab3d.hubEnabled && (
            <>
              <Num label="Hub Diameter (mm)" value={fab3d.hubDiameterMm} min={1}   max={200} step={0.5} onChange={v => onSetFab3d({ hubDiameterMm: v })} />
              <Num label="Hub Height (mm)"   value={fab3d.hubHeightMm}   min={0.5} max={100} step={0.5} onChange={v => onSetFab3d({ hubHeightMm: v })} />
            </>
          )}

          <section className="field" style={{ marginBottom: 4 }}>
            <h2 className="field-title">Format</h2>
            <div className="segmented cols-2">
              <button className="active">STL</button>
              <button disabled style={{ opacity: 0.4 }}>STEP</button>
            </div>
          </section>
        </>
      )}

    </aside>
  );
}
