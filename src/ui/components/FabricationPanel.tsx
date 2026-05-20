import { useState } from 'react';
import type { FabricationMode, FabricationState2D, FabricationState3D, SpurGear, UnitSystem } from '../../core/gearTypes';
import type { ExportType } from './TopBar';

type ExportFormat = 'svg' | 'dxf';

interface Props {
  fabricationMode: FabricationMode;
  fab2d: FabricationState2D;
  fab3d: FabricationState3D;
  unitSystem: UnitSystem;
  g1: SpurGear;
  g2: SpurGear;
  onSetFabricationMode: (m: FabricationMode) => void;
  onSetFab2d: (u: Partial<FabricationState2D>) => void;
  onSetFab3d: (u: Partial<FabricationState3D>) => void;
  onExport: (type: ExportType) => void;
}

const KERF = [{ label: 'Off', v: 0 }, { label: '0.10', v: 0.1 }, { label: '0.15', v: 0.15 }];

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="fab-check">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="field">
      <h2 className="field-title">{title}</h2>
      {children}
    </section>
  );
}

export default function FabricationPanel({
  fabricationMode, fab2d, fab3d, g1, g2,
  onSetFabricationMode, onSetFab2d, onSetFab3d, onExport,
}: Props) {
  const [fmt, setFmt] = useState<ExportFormat>('svg');

  const doExport = (target: 'output' | 'input' | 'pair') => {
    onExport(fmt === 'dxf' ? `${target}-dxf` as ExportType : target);
  };

  return (
    <div className="fab-panel">
      <div className="fab-panel-header">
        <span>Fabrication</span>
      </div>
      <div className="fab-panel-body">

        <Section title="Mode">
          <div className="segmented cols-2">
            <button className={fabricationMode === '2d-laser' ? 'active' : ''}
              onClick={() => onSetFabricationMode('2d-laser')}>2D Laser</button>
            <button className={fabricationMode === '3d-print' ? 'active' : ''}
              onClick={() => onSetFabricationMode('3d-print')}>3D Print</button>
          </div>
        </Section>

        {fabricationMode === '2d-laser' ? (
          <>
            <Section title="Include">
              <div className="fab-check-list">
                <CheckRow label="Gear outline"   checked={fab2d.showOutline}      onChange={v => onSetFab2d({ showOutline: v })} />
                <CheckRow label="Center marks"   checked={fab2d.showCenters}      onChange={v => onSetFab2d({ showCenters: v })} />
                <CheckRow label="Pitch circles"  checked={fab2d.showPitchCircles} onChange={v => onSetFab2d({ showPitchCircles: v })} />
                <CheckRow label="Labels"         checked={fab2d.showLabels}       onChange={v => onSetFab2d({ showLabels: v })} />
              </div>
            </Section>

            <Section title="Kerf Compensation">
              <div className="segmented cols-3">
                {KERF.map(k => (
                  <button key={k.v} className={fab2d.kerfOffsetMm === k.v ? 'active' : ''}
                    onClick={() => onSetFab2d({ kerfOffsetMm: k.v })}>
                    {k.label}
                  </button>
                ))}
              </div>
              {fab2d.kerfOffsetMm > 0 && (
                <p className="fab-hint">Offset: −{fab2d.kerfOffsetMm} mm on outline, +{fab2d.kerfOffsetMm} mm on bore</p>
              )}
            </Section>

            <Section title="Format">
              <div className="segmented cols-2">
                <button className={fmt === 'svg' ? 'active' : ''} onClick={() => setFmt('svg')}>SVG</button>
                <button className={fmt === 'dxf' ? 'active' : ''} onClick={() => setFmt('dxf')}>DXF R12</button>
              </div>
            </Section>

            <Section title="Export">
              <div className="fab-export-col">
                <button className="fab-export-btn" onClick={() => doExport('output')}>
                  Output gear — {g1.teeth}T
                </button>
                <button className="fab-export-btn" onClick={() => doExport('input')}>
                  Input gear — {g2.teeth}T
                </button>
                <button className="fab-export-btn" onClick={() => doExport('pair')}>
                  Gear pair
                </button>
              </div>
            </Section>
          </>
        ) : (
          <>
            <Section title="Face Width">
              <input className="text-input" type="number" min={0.5} max={500} step={0.5}
                value={fab3d.faceWidthMm}
                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) onSetFab3d({ faceWidthMm: v }); }} />
            </Section>

            <Section title="Bore Diameter">
              <input className="text-input" type="number" min={0.5} max={200} step={0.5}
                value={fab3d.boreDiameterMm}
                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) onSetFab3d({ boreDiameterMm: v }); }} />
            </Section>

            <Section title="Hub">
              <div className="segmented cols-2">
                <button className={!fab3d.hubEnabled ? 'active' : ''} onClick={() => onSetFab3d({ hubEnabled: false })}>Off</button>
                <button className={fab3d.hubEnabled  ? 'active' : ''} onClick={() => onSetFab3d({ hubEnabled: true  })}>On</button>
              </div>
            </Section>

            {fab3d.hubEnabled && (
              <>
                <Section title="Hub Diameter">
                  <input className="text-input" type="number" min={1} max={200} step={0.5}
                    value={fab3d.hubDiameterMm}
                    onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) onSetFab3d({ hubDiameterMm: v }); }} />
                </Section>
                <Section title="Hub Height">
                  <input className="text-input" type="number" min={0.5} max={100} step={0.5}
                    value={fab3d.hubHeightMm}
                    onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) onSetFab3d({ hubHeightMm: v }); }} />
                </Section>
              </>
            )}

            <Section title="Format">
              <div className="segmented cols-2">
                <button className="active">STL</button>
                <button disabled style={{ opacity: 0.4 }}>STEP</button>
              </div>
            </Section>

            <Section title="Export">
              <button className="fab-export-btn" disabled style={{ opacity: 0.45, cursor: 'not-allowed' }}>
                Export STL — Available in R4
              </button>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
