import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import type { BoreType } from '../../core/gearTypes';

import DwayImg     from '../../../assets/img/Dway.png';
import KeyshaftImg from '../../../assets/img/keyshaft.png';
import RoundImg    from '../../../assets/img/Round.png';

const BORE_IMG: Record<Exclude<BoreType, 'none'>, string> = {
  'keyway':  KeyshaftImg,
  'd-shaft': DwayImg,
  'round':   RoundImg,
};

// Exported: used in BoreEditModal preview and type buttons
export function BoreIcon({ type, size = 36 }: { type: BoreType; size?: number }) {
  if (type === 'none') {
    const r = Math.max(1, size * 0.045);
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        border: `${r}px dashed var(--text-muted)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-muted)', fontSize: Math.round(size * 0.42),
        flexShrink: 0, opacity: 0.55,
      }}>—</div>
    );
  }
  return (
    <img src={BORE_IMG[type]} alt={type}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }} />
  );
}

// Inverted order: Keyway → D-Shaft → Round → None
const CATALOG: { value: BoreType; label: string }[] = [
  { value: 'keyway',  label: 'Keyway'  },
  { value: 'd-shaft', label: 'D-Shaft' },
  { value: 'round',   label: 'Round'   },
  { value: 'none',    label: 'None'    },
];

const BORE_TYPES = CATALOG.filter(o => o.value !== 'none');

interface Props {
  g1BoreType:  BoreType;
  g2BoreType:  BoreType;
  onChange:    (type: BoreType) => void;
  onEditClick: () => void;
}

export default function BoreTypeSelector({ g1BoreType, g2BoreType, onChange, onEditClick }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef    = useRef<HTMLDivElement>(null);

  const same         = g1BoreType === g2BoreType;
  const displayType  = same ? g1BoreType : 'none';
  const displayLabel = same
    ? (CATALOG.find(o => o.value === g1BoreType)?.label ?? 'None')
    : 'Mixed';

  useLayoutEffect(() => {
    if (open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !dropRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const isActive = (v: BoreType) => same && g1BoreType === v;

  const dropdown = open ? createPortal(
    <div ref={dropRef} className="bts-dropdown"
      style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: Math.max(pos.width, 190) }}>

      {/* Keyway · D-Shaft · Round */}
      {BORE_TYPES.map(o => (
        <button key={o.value}
          className={`bts-option${isActive(o.value) ? ' active' : ''}`}
          onClick={() => { onChange(o.value); setOpen(false); }}>
          <img src={BORE_IMG[o.value as Exclude<BoreType,'none'>]} alt={o.label} className="bts-opt-img" />
          <span className="bts-opt-label">{o.label}</span>
        </button>
      ))}

      {/* Separator before None */}
      <div className="bts-separator" />

      {/* None — special */}
      <button
        className={`bts-option bts-option-none${isActive('none') ? ' active' : ''}`}
        onClick={() => { onChange('none'); setOpen(false); }}>
        <BoreIcon type="none" size={36} />
        <span className="bts-opt-label bts-opt-none-label">None</span>
      </button>
    </div>,
    document.body
  ) : null;

  return (
    <div className="bts-wrap">
      {/* ── Trigger (GTS-style grid) ── */}
      <button ref={triggerRef} type="button"
        className={`bts-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen(o => !o)}>
        <BoreIcon type={displayType} size={32} />
        <span className="bts-label">{displayLabel}</span>
        <svg className={`bts-caret${open ? ' open' : ''}`} width="9" height="5"
          viewBox="0 0 9 5" fill="none">
          <path d="M0.5 0.5L4.5 4.5L8.5 0.5" stroke="currentColor" strokeWidth="1.4"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* ── Edit button (prominent, red accent) ── */}
      <button type="button" className="bts-edit-btn" onClick={onEditClick} title="Edit bore settings">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor"
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 2L14 5L6 13H3V10L11 2Z"/>
        </svg>
        <span>Edit</span>
      </button>

      {dropdown}
    </div>
  );
}
