import type { Axial } from "@/domain/geometry/hex";
import type { EditGestureAction } from "@/editor/tools/editGesture";
import type { EditorMode } from "@/editor/tools/editorTypes";
import type { RiverEdgeRef, World } from "@/domain/world/world";

export type HexCanvasProps = {
  world: World;
  level: number;
  center: Axial;
  visualZoom: number;
  hoveredHex: Axial | null;
  editMode: EditorMode;
  interactionLabel: string;
  showCoordinates: boolean;
  onCenterChange: (center: Axial) => void;
  onVisualZoomChange: (zoom: number) => void;
  onEditGestureStart: (action: EditGestureAction, axials: Axial[]) => void;
  onEditGestureMove: (axials: Axial[]) => void;
  onRiverGestureStart: (action: EditGestureAction, edges: RiverEdgeRef[]) => void;
  onRiverGestureMove: (edges: RiverEdgeRef[]) => void;
  onEditGestureEnd: () => void;
  onRiverGestureEnd: () => void;
  onHoveredHexChange: (axial: Axial | null) => void;
};
