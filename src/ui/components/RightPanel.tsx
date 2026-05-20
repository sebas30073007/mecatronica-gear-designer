import type { FabricationMode, FabricationState2D, FabricationState3D, SpurGear, UnitSystem } from '../../core/gearTypes';
import type { ExportType } from './TopBar';
import FabricationPanel from './FabricationPanel';

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

export default function RightPanel(props: Props) {
  return (
    <aside className="panel right-panel">
      <FabricationPanel {...props} />
    </aside>
  );
}
