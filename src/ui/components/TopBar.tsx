export type ExportType = 'output' | 'input' | 'pair' | 'output-dxf' | 'input-dxf' | 'pair-dxf';

interface Props {
  summary: string;
}

export default function TopBar({ summary }: Props) {
  return (
    <header className="topbar">
      <div className="logo">
        MECATR<span className="gear-o" aria-hidden="true" />NICA
      </div>
      <div className="topbar-divider" />
      <div className="topbar-center">
        <span className="topbar-project">Reductora-01</span>
        <span className="topbar-sep">/</span>
        <span className="topbar-summary">{summary}</span>
      </div>
    </header>
  );
}
