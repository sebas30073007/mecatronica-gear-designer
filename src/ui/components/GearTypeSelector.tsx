import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ActiveMode } from '../../core/gearTypes';

import rectoImg      from '../../../assets/img/recto.png';
import planetarioImg from '../../../assets/img/planetario.png';
import anilloImg     from '../../../assets/img/anillo.png';
import pinonImg      from '../../../assets/img/piñon_cremallera.png';
import compuestoImg  from '../../../assets/img/compuesto.png';
import helicalImg    from '../../../assets/img/helicoidal.png';
import conicoImg     from '../../../assets/img/conico.png';
import herringboneImg from '../../../assets/img/helicoidal doble.png';
import wormImg        from '../../../assets/img/sin_fin.png';

const ICONS: Record<ActiveMode, string> = {
  simple:        rectoImg,
  planetary:     planetarioImg,
  internal:      anilloImg,
  'rack-pinion': pinonImg,
  compound:      compuestoImg,
  helical:       helicalImg,
  bevel:         conicoImg,
  herringbone:   herringboneImg,
  worm:          wormImg,
};

const CATALOG = [
  { value: 'simple'      as ActiveMode, label: 'Simple Gear Train',           view: '2d-3d'   },
  { value: 'planetary'   as ActiveMode, label: 'Planetary (Epicyclic)',        view: '2d-3d'   },
  { value: 'internal'    as ActiveMode, label: 'Internal Gear (Ring)',         view: '2d-3d'   },
  { value: 'rack-pinion' as ActiveMode, label: 'Rack & Pinion',               view: '2d-3d'   },
  { value: 'compound'    as ActiveMode, label: 'Compound Gear Train',          view: '3d-only' },
  { value: 'helical'     as ActiveMode, label: 'Helical Gear Pair',            view: '3d-only' },
  { value: 'bevel'       as ActiveMode, label: 'Bevel (Conic) Gear',           view: '3d-only' },
  { value: 'herringbone' as ActiveMode, label: 'Herringbone (Double Helical)', view: '3d-only' },
  { value: 'worm'        as ActiveMode, label: 'Worm Gear (Sin Fin)',          view: '3d-only' },
];

const toggleable = CATALOG.filter(e => e.view === '2d-3d');
const only3d     = CATALOG.filter(e => e.view === '3d-only');

interface DropPos { top: number; left: number; width: number; }

interface Props {
  value: ActiveMode;
  onChange: (mode: ActiveMode) => void;
}

export default function GearTypeSelector({ value, onChange }: Props) {
  const [open, setOpen]       = useState(false);
  const [pos, setPos]         = useState<DropPos>({ top: 0, left: 0, width: 0 });
  const triggerRef            = useRef<HTMLButtonElement>(null);
  const dropdownRef           = useRef<HTMLDivElement>(null);
  const selected              = CATALOG.find(e => e.value === value) ?? CATALOG[0]!;

  // Recompute dropdown position whenever it opens
  useLayoutEffect(() => {
    if (open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 5, left: r.left, width: r.width });
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(t) &&
        dropdownRef.current && !dropdownRef.current.contains(t)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const renderOption = (entry: typeof CATALOG[0]) => (
    <button
      key={entry.value}
      className={`gts-option${entry.value === value ? ' active' : ''}`}
      onClick={() => { onChange(entry.value); setOpen(false); }}
    >
      <img src={ICONS[entry.value]} alt="" className="gts-icon" />
      <span className="gts-label">{entry.label}</span>
    </button>
  );

  const dropdown = open ? createPortal(
    <div
      ref={dropdownRef}
      className="gts-dropdown"
      style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width }}
    >
      <div className="gts-group-label">2D / 3D Toggle</div>
      {toggleable.map(renderOption)}
      <div className="gts-separator" />
      <div className="gts-group-label">3D Only</div>
      {only3d.map(renderOption)}
    </div>,
    document.body
  ) : null;

  return (
    <div className="gts-wrap">
      <button
        ref={triggerRef}
        className={`gts-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen(o => !o)}
        type="button"
      >
        <img src={ICONS[value]} alt="" className="gts-icon" />
        <span className="gts-label">{selected.label}</span>
        <svg className={`gts-caret${open ? ' open' : ''}`} width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {dropdown}
    </div>
  );
}
