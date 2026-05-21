interface Props {
  summary: string;
  debug: boolean;
  showRuler: boolean;
  onDebugToggle: () => void;
  onRulerToggle: () => void;
  onExportClick: () => void;
}

export default function TopBar({ summary, debug, showRuler, onDebugToggle, onRulerToggle, onExportClick }: Props) {
  return (
    <header className="topbar">

      {/* ── Left: logo ───────────────────────────────── */}
      <div className="logo">
        MECATR<span className="gear-o" aria-hidden="true" />NICA
      </div>

      <div className="topbar-divider" />

      {/* ── Center: project name + technical summary ─── */}
      <div className="topbar-center">
        <span className="topbar-project">Reductora-01</span>
        <span className="topbar-sep">/</span>
        <span className="topbar-summary">{summary}</span>
      </div>

      {/* ── Right: quick tools + export ──────────────── */}
      <div className="topbar-actions">
        <button className="icon-action" title="Debug overlay"
          style={{ color: debug ? 'var(--red)' : undefined }}
          onClick={onDebugToggle}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <circle cx="12" cy="12" r="7" strokeDasharray="3 2"/>
            <circle cx="12" cy="12" r="10" strokeDasharray="2 3" opacity=".5"/>
          </svg>
        </button>
        <button className="icon-action" title="Dimensiones"
          style={{ color: showRuler ? 'var(--red)' : undefined }}
          onClick={onRulerToggle}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="10" rx="1.5" strokeWidth={1.75}/>
            <line x1="6"  y1="7" x2="6"  y2="11" strokeWidth={1.5}/>
            <line x1="10" y1="7" x2="10" y2="12" strokeWidth={1.5}/>
            <line x1="14" y1="7" x2="14" y2="11" strokeWidth={1.5}/>
            <line x1="18" y1="7" x2="18" y2="11" strokeWidth={1.5}/>
          </svg>
        </button>
        <button className="download" onClick={onExportClick}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>
          </svg>
          Export
        </button>
      </div>

    </header>
  );
}
