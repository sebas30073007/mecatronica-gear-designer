import type { ReactNode } from 'react';
import type {
  SpurGear, ActiveMode, UnitSystem,
  RackPinionParams, InternalGearParams, PlanetaryParams,
} from '../../core/gearTypes';
import { rackMinLength, internalGearValid, planetaryRingTeeth, planetarySpacingOk } from '../../core/gearTypes';
import type { ValidationWarning } from '../../core/validation';
import { fmtModule } from '../../core/units';
import TeethStepper from '../primitives/TeethStepper';
import GearTypeSelector from './GearTypeSelector';

const MODULES_SMALL = [1.0, 1.25, 1.5, 2.0, 2.5, 3.0];

interface Props {
  g1: SpurGear; g2: SpurGear;
  moduleMm: number; pa: number; unitSystem: UnitSystem; activeMode: ActiveMode;
  warnings: ValidationWarning[];
  rackPinion: RackPinionParams; internalGear: InternalGearParams;
  planetary: PlanetaryParams;
  onSetTeeth:        (id: string, teeth: number) => void;
  onSetModule:       (m: number) => void;
  onSetPressureAngle:(deg: number) => void;
  onSetUnitSystem:   (s: UnitSystem) => void;
  onSetActiveMode:   (m: ActiveMode) => void;
  onSetRackPinion:   (u: Partial<RackPinionParams>) => void;
  onSetInternalGear: (u: Partial<InternalGearParams>) => void;
  onSetPlanetary:    (u: Partial<PlanetaryParams>) => void;
  onExportClick:  () => void;
}

// ── Primitive ribbon building-blocks ─────────────────────────────────────────

function Grp({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rbn-group">
      <div className="rbn-controls">{children}</div>
      <div className="rbn-label">{label}</div>
    </div>
  );
}

function RDiv() { return <div className="rbn-divider" />; }

function ModSel({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="rbn-select-wrap">
      <select className="rbn-select" value={value}
        onChange={e => onChange(parseFloat(e.target.value))}>
        {MODULES_SMALL.map(m => (
          <option key={m} value={m}>{fmtModule(m, 'metric')}</option>
        ))}
      </select>
    </div>
  );
}

function PASeg({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="segmented rbn-segmented cols-3">
      {([14.5, 20, 25] as const).map(d => (
        <button key={d} className={value === d ? 'active' : ''} onClick={() => onChange(d)}>{d}°</button>
      ))}
    </div>
  );
}

function NumIn({ value, min, max, step = 1, onChange }: {
  value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <input className="rbn-number" type="number"
      min={min} max={max} step={step} value={value}
      onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= min) onChange(v); }}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ToolRibbon({
  g1, g2, moduleMm, pa, unitSystem, activeMode, warnings,
  rackPinion, internalGear, planetary,
  onSetTeeth, onSetModule, onSetPressureAngle, onSetUnitSystem, onSetActiveMode,
  onSetRackPinion, onSetInternalGear, onSetPlanetary,
  onExportClick,
}: Props) {
  return (
    <div className="ribbon">

      {/* ── Type ─────────────────────────────────────── */}
      <Grp label="Type">
        <div className="rbn-type-wrap">
          <GearTypeSelector value={activeMode} onChange={onSetActiveMode} />
        </div>
      </Grp>
      <RDiv />

      {/* ── Simple spur gear ─────────────────────────── */}
      {activeMode === 'simple' && <>
        <Grp label="Teeth">
          <TeethStepper label="Output" value={g1.teeth} onChange={v => onSetTeeth(g1.id, v)} />
          <TeethStepper label="Input"  value={g2.teeth} onChange={v => onSetTeeth(g2.id, v)} />
        </Grp>
        <RDiv />
        <Grp label="Module">
          <ModSel value={moduleMm} onChange={onSetModule} />
        </Grp>
        <RDiv />
        <Grp label="Tooth Profile">
          <PASeg value={pa} onChange={onSetPressureAngle} />
        </Grp>
        <RDiv />
        <Grp label="Units">
          <div className="segmented rbn-segmented cols-2">
            <button className={unitSystem === 'metric'   ? 'active' : ''} onClick={() => onSetUnitSystem('metric')}>mm</button>
            <button className={unitSystem === 'imperial' ? 'active' : ''} onClick={() => onSetUnitSystem('imperial')}>in</button>
          </div>
        </Grp>
        {warnings.length > 0 && <>
          <RDiv />
          <div className="rbn-warn-area">
            {warnings.slice(0, 2).map((w, i) => (
              <span key={i} className={`rbn-warn-chip rbn-warn-${w.severity}`}>{w.message}</span>
            ))}
          </div>
        </>}
      </>}

      {/* ── Rack & Pinion ────────────────────────────── */}
      {activeMode === 'rack-pinion' && <>
        <Grp label="Pinion">
          <TeethStepper label="Teeth" value={rackPinion.pinionTeeth} min={8} max={30}
            onChange={v => {
              const rp = { ...rackPinion, pinionTeeth: v };
              onSetRackPinion({ pinionTeeth: v, rackLengthMm: Math.max(rp.rackLengthMm, rackMinLength(rp)) });
            }} />
        </Grp>
        <RDiv />
        <Grp label="Module">
          <ModSel value={rackPinion.moduleMm}
            onChange={v => {
              const rp = { ...rackPinion, moduleMm: v };
              onSetRackPinion({ moduleMm: v, rackLengthMm: Math.max(rp.rackLengthMm, rackMinLength(rp)) });
            }} />
        </Grp>
        <RDiv />
        <Grp label="Tooth Profile">
          <PASeg value={rackPinion.pressureAngleDeg}
            onChange={v => onSetRackPinion({ pressureAngleDeg: v })} />
        </Grp>
        <RDiv />
        <Grp label="Rack Length">
          <NumIn value={rackPinion.rackLengthMm}
            min={rackMinLength(rackPinion)} max={200} step={5}
            onChange={v => onSetRackPinion({ rackLengthMm: Math.min(200, Math.max(v, rackMinLength(rackPinion))) })} />
        </Grp>
        <RDiv />
        <Grp label="Face Width">
          <NumIn value={rackPinion.thicknessMm} min={5} max={50}
            onChange={v => onSetRackPinion({ thicknessMm: v })} />
        </Grp>
      </>}

      {/* ── Internal Gear ────────────────────────────── */}
      {activeMode === 'internal' && <>
        <Grp label="Teeth">
          <TeethStepper label="Ring"   value={internalGear.ringTeeth}   min={24} max={80}
            onChange={v => onSetInternalGear({ ringTeeth: Math.max(v, internalGear.pinionTeeth + 8) })} />
          <TeethStepper label="Pinion" value={internalGear.pinionTeeth} min={8}  max={30}
            onChange={v => onSetInternalGear({ pinionTeeth: Math.min(v, internalGear.ringTeeth - 8) })} />
        </Grp>
        <RDiv />
        <Grp label="Module">
          <ModSel value={internalGear.moduleMm} onChange={v => onSetInternalGear({ moduleMm: v })} />
        </Grp>
        <RDiv />
        <Grp label="Pressure Angle">
          <PASeg value={internalGear.pressureAngleDeg}
            onChange={v => onSetInternalGear({ pressureAngleDeg: v })} />
        </Grp>
        <RDiv />
        <Grp label="Wall (mm)">
          <div className="segmented rbn-segmented cols-4">
            {[2, 3, 4, 6].map(v => (
              <button key={v} className={internalGear.wallThicknessMm === v ? 'active' : ''}
                onClick={() => onSetInternalGear({ wallThicknessMm: v })}>{v}</button>
            ))}
          </div>
        </Grp>
        <RDiv />
        <Grp label="Face Width">
          <NumIn value={internalGear.thicknessMm} min={5} max={50}
            onChange={v => onSetInternalGear({ thicknessMm: v })} />
        </Grp>
        {!internalGearValid(internalGear) && <>
          <RDiv />
          <div className="rbn-warn-area">
            <span className="rbn-warn-chip rbn-warn-error">Ring − Pinion ≥ 8</span>
          </div>
        </>}
      </>}

      {/* ── Planetary Gear ───────────────────────────── */}
      {activeMode === 'planetary' && <>
        <Grp label="Teeth">
          <TeethStepper label="Sun"    value={planetary.sunTeeth}    min={10} max={36}
            onChange={v => onSetPlanetary({ sunTeeth: v })} />
          <TeethStepper label="Planet" value={planetary.planetTeeth} min={6}  max={20}
            onChange={v => onSetPlanetary({ planetTeeth: v })} />
        </Grp>
        <RDiv />
        <Grp label="Planets">
          <div className="segmented rbn-segmented cols-3">
            {[3, 4, 5].map(n => (
              <button key={n} className={planetary.planetCount === n ? 'active' : ''}
                onClick={() => onSetPlanetary({ planetCount: n })}>{n}</button>
            ))}
          </div>
        </Grp>
        <RDiv />
        <Grp label="Module">
          <ModSel value={planetary.moduleMm} onChange={v => onSetPlanetary({ moduleMm: v })} />
        </Grp>
        <RDiv />
        <Grp label="Pressure Angle">
          <PASeg value={planetary.pressureAngleDeg} onChange={v => onSetPlanetary({ pressureAngleDeg: v })} />
        </Grp>
        <RDiv />
        <Grp label="Ring Teeth">
          <div className="rbn-ratio-badge">
            {planetaryRingTeeth(planetary)}<span>T</span>
          </div>
        </Grp>
        {!planetarySpacingOk(planetary) && <>
          <RDiv />
          <div className="rbn-warn-area">
            <span className="rbn-warn-chip rbn-warn-warn">
              (Sun+Ring) % planets ≠ 0 — unequal spacing
            </span>
          </div>
        </>}
      </>}

      {/* ── Spacer ───────────────────────────────────── */}
      <div className="rbn-spacer" />

      {/* ── Export ───────────────────────────────────── */}
      <div className="rbn-export-zone">
        <button className="download" onClick={onExportClick}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>
          </svg>
          Export
        </button>
      </div>

    </div>
  );
}
