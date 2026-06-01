import { useState, useEffect, type ReactNode } from 'react';
import type {
  SpurGear, ActiveMode, UnitSystem, BoreType,
  RackPinionParams, InternalGearParams, PlanetaryParams, HelicalParams, WormParams, BevelParams,
} from '../../core/gearTypes';
import { rackMinLength, internalGearValid, planetaryRingTeeth, planetarySpacingOk, bevelConeLength } from '../../core/gearTypes';
import type { ValidationWarning } from '../../core/validation';
import { fmtModule } from '../../core/units';
import TeethStepper from '../primitives/TeethStepper';
import GearTypeSelector from './GearTypeSelector';
import BoreTypeSelector from './BoreTypeSelector';

const MODULES_SMALL = [1.0, 1.25, 1.5, 2.0, 2.5, 3.0];

interface Props {
  g1: SpurGear; g2: SpurGear;
  moduleMm: number; pa: number; unitSystem: UnitSystem; activeMode: ActiveMode;
  warnings: ValidationWarning[];
  is3d: boolean; faceWidthMm: number;
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
  helical: HelicalParams;
  onSetHelical:      (u: Partial<HelicalParams>) => void;
  herringbone: HelicalParams;
  onSetHerringbone:  (u: Partial<HelicalParams>) => void;
  worm: WormParams;
  onSetWorm:         (u: Partial<WormParams>) => void;
  bevel: BevelParams;
  onSetBevel:        (u: Partial<BevelParams>) => void;
  onSetFaceWidth:    (mm: number) => void;
  onSetBoreType:     (id: string, type: BoreType) => void;
  onSetBoreDiameter: (id: string, mm: number) => void;
  onBoreEditClick:   () => void;
  onExportClick:     () => void;
}

// ── Primitive ribbon building-blocks ─────────────────────────────────────────

function Grp({ label, children, center }: { label: string; children: ReactNode; center?: boolean }) {
  return (
    <div className="rbn-group">
      <div className={center ? 'rbn-controls rbn-controls--center' : 'rbn-controls'}>{children}</div>
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

function PAStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const MIN = 20, MAX = 30;
  const clamp = (v: number) => Math.min(MAX, Math.max(MIN, v));
  const [raw, setRaw] = useState(String(value));
  useEffect(() => { setRaw(String(value)); }, [value]);
  const commit = () => {
    const v = parseInt(raw, 10);
    if (isNaN(v)) { setRaw(String(value)); return; }
    const c = clamp(v); setRaw(String(c)); onChange(c);
  };
  return (
    <div className="rbn-pa-stepper">
      <button onClick={() => onChange(clamp(value - 1))} disabled={value <= MIN}>−</button>
      <div className="rbn-pa-value">
        <input
          type="number" min={MIN} max={MAX} step={1} value={raw}
          onChange={e => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur(); } }}
        />
        <span>°</span>
      </div>
      <button onClick={() => onChange(clamp(value + 1))} disabled={value >= MAX}>+</button>
    </div>
  );
}

function NumIn({ value, min, max, step = 1, onChange }: {
  value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void;
}) {
  const [raw, setRaw] = useState(String(value));
  useEffect(() => { setRaw(String(value)); }, [value]);
  const commit = () => {
    const v = parseFloat(raw);
    if (isNaN(v)) { setRaw(String(value)); return; }
    const c = Math.min(max, Math.max(min, v)); setRaw(String(c)); onChange(c);
  };
  return (
    <input className="rbn-number" type="number" step={step} value={raw}
      onChange={e => setRaw(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur(); } }}
    />
  );
}

const IMPERIAL_FRACS = [
  { label: '1/8"',   mm: 3.175  }, { label: '3/16"', mm: 4.762  },
  { label: '1/4"',   mm: 6.350  }, { label: '5/16"', mm: 7.938  },
  { label: '3/8"',   mm: 9.525  }, { label: '1/2"',  mm: 12.700 },
  { label: '5/8"',   mm: 15.875 }, { label: '3/4"',  mm: 19.050 },
  { label: '7/8"',   mm: 22.225 }, { label: '1"',    mm: 25.400 },
  { label: '1-1/4"', mm: 31.750 },
];
function nearestFrac(mm: number): string {
  return IMPERIAL_FRACS.reduce((a, b) =>
    Math.abs(a.mm - mm) <= Math.abs(b.mm - mm) ? a : b
  ).label;
}

function FaceSlider({ value, unitSystem, onChange, min = 3 }: {
  value: number; unitSystem: UnitSystem; onChange: (mm: number) => void; min?: number;
}) {
  const display = unitSystem === 'imperial' ? nearestFrac(value) : `${value} mm`;
  return (
    <div className="rbn-face-slider">
      <input type="range" min={min} max={30} step={1} value={value}
        onChange={e => onChange(parseInt(e.target.value, 10))} />
      <span className="rbn-face-val">{display}</span>
    </div>
  );
}


// ── Main component ────────────────────────────────────────────────────────────

export default function ToolRibbon({
  g1, g2, moduleMm, pa, unitSystem, activeMode, warnings, is3d,
  faceWidthMm, rackPinion, internalGear, planetary, helical, herringbone, worm, bevel,
  onSetTeeth, onSetModule, onSetPressureAngle, onSetUnitSystem, onSetActiveMode,
  onSetRackPinion, onSetInternalGear, onSetPlanetary, onSetHelical, onSetHerringbone, onSetWorm, onSetBevel, onSetFaceWidth,
  onSetBoreType, onSetBoreDiameter, onBoreEditClick,
  onExportClick,
}: Props) {
  const showFaceSlider = is3d;
  return (
    <div className="ribbon">

      {/* ── Type ─────────────────────────────────────── */}
      <Grp label="Type" center>
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
          <PAStepper value={pa} onChange={onSetPressureAngle} />
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
        <RDiv />
        <Grp label="Hole Type">
          <div className="rbn-bore-wrap">
            <BoreTypeSelector
              g1BoreType={g1.boreType}
              g2BoreType={g2.boreType}
              boreDiameterMm={g1.boreDiameterMm}
              onChange={type => { onSetBoreType(g1.id, type); onSetBoreType(g2.id, type); }}
              onChangeDiameter={mm => { onSetBoreDiameter(g1.id, mm); onSetBoreDiameter(g2.id, mm); }}
              onEditClick={onBoreEditClick}
            />
          </div>
        </Grp>
        <RDiv />
        <Grp label="Face Width">
          <FaceSlider value={faceWidthMm} unitSystem={unitSystem} onChange={onSetFaceWidth} min={3} />
        </Grp>
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
          <PAStepper value={rackPinion.pressureAngleDeg}
            onChange={v => onSetRackPinion({ pressureAngleDeg: v })} />
        </Grp>
        <RDiv />
        <Grp label="Rack Length">
          <NumIn value={rackPinion.rackLengthMm}
            min={rackMinLength(rackPinion)} max={200} step={5}
            onChange={v => onSetRackPinion({ rackLengthMm: Math.min(200, Math.max(v, rackMinLength(rackPinion))) })} />
        </Grp>
        {!is3d && <>
          <RDiv />
          <Grp label="Face Width">
            <NumIn value={rackPinion.thicknessMm} min={5} max={50}
              onChange={v => onSetRackPinion({ thicknessMm: v })} />
          </Grp>
        </>}
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
          <PAStepper value={internalGear.pressureAngleDeg}
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
        {!is3d && <>
          <RDiv />
          <Grp label="Face Width">
            <NumIn value={internalGear.thicknessMm} min={5} max={50}
              onChange={v => onSetInternalGear({ thicknessMm: v })} />
          </Grp>
        </>}
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
          <PAStepper value={planetary.pressureAngleDeg} onChange={v => onSetPlanetary({ pressureAngleDeg: v })} />
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

      {/* ── Helical Gear ─────────────────────────────── */}
      {activeMode === 'helical' && <>
        <Grp label="Teeth">
          <TeethStepper label="Output" value={helical.outputTeeth} onChange={v => onSetHelical({ outputTeeth: v })} />
          <TeethStepper label="Input"  value={helical.inputTeeth}  onChange={v => onSetHelical({ inputTeeth: v })} />
        </Grp>
        <RDiv />
        <Grp label="Module">
          <ModSel value={helical.moduleMm} onChange={v => onSetHelical({ moduleMm: v })} />
        </Grp>
        <RDiv />
        <Grp label="Tooth Profile">
          <PAStepper value={helical.pressureAngleDeg} onChange={v => onSetHelical({ pressureAngleDeg: v })} />
        </Grp>
        <RDiv />
        <Grp label="Helix Angle">
          <div className="rbn-face-slider">
            <input type="range" min={10} max={35} step={1} value={helical.helixAngleDeg}
              onChange={e => onSetHelical({ helixAngleDeg: parseInt(e.target.value) })} />
            <span className="rbn-face-val">{helical.helixAngleDeg}°</span>
          </div>
        </Grp>
      </>}

      {/* ── Herringbone (Double Helical) ─────────────── */}
      {activeMode === 'herringbone' && <>
        <Grp label="Teeth">
          <TeethStepper label="Output" value={herringbone.outputTeeth} onChange={v => onSetHerringbone({ outputTeeth: v })} />
          <TeethStepper label="Input"  value={herringbone.inputTeeth}  onChange={v => onSetHerringbone({ inputTeeth: v })} />
        </Grp>
        <RDiv />
        <Grp label="Module">
          <ModSel value={herringbone.moduleMm} onChange={v => onSetHerringbone({ moduleMm: v })} />
        </Grp>
        <RDiv />
        <Grp label="Tooth Profile">
          <PAStepper value={herringbone.pressureAngleDeg} onChange={v => onSetHerringbone({ pressureAngleDeg: v })} />
        </Grp>
        <RDiv />
        <Grp label="Helix Angle">
          <div className="rbn-face-slider">
            <input type="range" min={10} max={35} step={1} value={herringbone.helixAngleDeg}
              onChange={e => onSetHerringbone({ helixAngleDeg: parseInt(e.target.value) })} />
            <span className="rbn-face-val">{herringbone.helixAngleDeg}°</span>
          </div>
        </Grp>
      </>}

      {/* ── Worm (Sin Fin) ───────────────────────────── */}
      {activeMode === 'worm' && <>
        <Grp label="Starts (Roscas)">
          <div className="segmented rbn-segmented cols-4">
            {([1, 2, 3, 4] as const).map(s => (
              <button key={s} className={worm.starts === s ? 'active' : ''}
                onClick={() => onSetWorm({ starts: s })}>{s}</button>
            ))}
          </div>
        </Grp>
        <RDiv />
        <Grp label="Wheel Teeth">
          <TeethStepper label="Teeth" value={worm.wheelTeeth} min={15} max={80}
            onChange={v => onSetWorm({ wheelTeeth: v })} />
        </Grp>
        <RDiv />
        <Grp label="Module">
          <ModSel value={worm.moduleMm} onChange={v => onSetWorm({ moduleMm: v })} />
        </Grp>
        <RDiv />
        <Grp label="Tooth Profile">
          <PAStepper value={worm.pressureAngleDeg} onChange={v => onSetWorm({ pressureAngleDeg: v })} />
        </Grp>
      </>}

      {/* ── Bevel (Conic) Gear ───────────────────────── */}
      {activeMode === 'bevel' && (() => {
        const L = bevelConeLength(bevel);
        const bMax = Math.floor(L / 3);
        return (
          <>
            <Grp label="Teeth">
              <TeethStepper label="Pinion" value={bevel.pinionTeeth} min={8}  max={30}
                onChange={v => onSetBevel({ pinionTeeth: v })} />
              <TeethStepper label="Gear"   value={bevel.gearTeeth}   min={12} max={80}
                onChange={v => onSetBevel({ gearTeeth: v })} />
            </Grp>
            <RDiv />
            <Grp label="Module">
              <ModSel value={bevel.moduleMm} onChange={v => onSetBevel({ moduleMm: v })} />
            </Grp>
            <RDiv />
            <Grp label="Tooth Profile">
              <PAStepper value={bevel.pressureAngleDeg} onChange={v => onSetBevel({ pressureAngleDeg: v })} />
            </Grp>
            <RDiv />
            <Grp label="Face Width">
              <div className="rbn-face-slider">
                <input type="range" min={3} max={Math.max(bMax, 4)} step={1}
                  value={Math.min(bevel.faceWidthMm, bMax)}
                  onChange={e => onSetBevel({ faceWidthMm: parseInt(e.target.value) })} />
                <span className="rbn-face-val">{bevel.faceWidthMm} mm</span>
              </div>
              {bevel.faceWidthMm > bMax && (
                <p style={{ fontSize: 10, color: 'var(--red)', margin: '2px 0 0' }}>
                  Recomendado: ≤ {bMax} mm
                </p>
              )}
            </Grp>
          </>
        );
      })()}

      {/* ── Face Width slider (3D only, non-simple modes except bevel) ─ */}
      {showFaceSlider && activeMode !== 'simple' && activeMode !== 'bevel' && <>
        <RDiv />
        <Grp label="Face Width">
          <FaceSlider
            value={faceWidthMm} unitSystem={unitSystem} onChange={onSetFaceWidth}
            min={activeMode === 'herringbone' || activeMode === 'worm' ? 5 : 3}
          />
        </Grp>
      </>}

      {/* ── Spacer ───────────────────────────────────── */}
      <div className="rbn-spacer" />

      {/* ── Export ───────────────────────────────────── */}
      <div className="rbn-export-zone">
        <button className="download" onClick={onExportClick}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>
          </svg>
          <span>Export</span>
        </button>
      </div>

    </div>
  );
}
