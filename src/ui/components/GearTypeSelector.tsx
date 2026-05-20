import type { ActiveMode, GearTypeEntry } from '../../core/gearTypes';

const CATALOG: GearTypeEntry[] = [
  { value: 'simple',      label: 'Simple Gear Train',           view: '2d-3d',   status: 'ready' },
  { value: 'planetary',   label: 'Planetary (Epicyclic)',        view: '2d-3d',   status: 'ready' },
  { value: 'internal',    label: 'Internal Gear (Ring)',         view: '2d-3d',   status: 'ready' },
  { value: 'rack-pinion', label: 'Rack & Pinion',               view: '2d-3d',   status: 'ready' },
  { value: 'compound',    label: 'Compound Gear Train',          view: '3d-only', status: 'ready' },
  { value: 'helical',     label: 'Helical Gear Pair',            view: '3d-only', status: 'ready' },
  { value: 'bevel',       label: 'Bevel (Conic) Gear',           view: '3d-only', status: 'ready' },
  { value: 'herringbone', label: 'Herringbone (Double Helical)', view: '3d-only', status: 'ready' },
];

interface Props {
  value: ActiveMode;
  onChange: (mode: ActiveMode) => void;
}

export default function GearTypeSelector({ value, onChange }: Props) {
  const toggleable = CATALOG.filter(e => e.view === '2d-3d');
  const only3d     = CATALOG.filter(e => e.view === '3d-only');

  return (
    <div className="select-wrap">
      <select className="text-input" value={value} onChange={e => onChange(e.target.value as ActiveMode)}>
        <optgroup label="2D / 3D Toggle">
          {toggleable.map(e => (
            <option key={e.value} value={e.value}>{e.label}</option>
          ))}
        </optgroup>
        <optgroup label="3D Only">
          {only3d.map(e => (
            <option key={e.value} value={e.value}>{e.label}</option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}
