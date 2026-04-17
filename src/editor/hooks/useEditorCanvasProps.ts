import { useMemo } from "react";
import type { Axial } from "@/core/geometry/hex";
import type { RiverEdgeRef, MapState } from "@/core/map/world";
import type { FeatureVisibilityMode } from "@/core/map/features";
import type { EditGestureAction } from "@/editor/tools/editGesture";
import type { EditorMode } from "@/editor/tools/editorTypes";
import type { HexCanvasProps } from "@/ui/components/MapCanvas/types";

type UseEditorCanvasPropsOptions = {
  activeMode: EditorMode;
  applyActiveGestureCells: (axials: Axial[]) => void;
  applyActiveRiverGestureEdges: (edges: RiverEdgeRef[]) => void;
  canEdit: boolean;
  center: Axial;
  changeVisualZoom: (zoom: number) => void;
  featureVisibilityMode: FeatureVisibilityMode;
  finishEditGesture: () => void;
  hoveredHex: Axial | null;
  interactionLabel: string;
  level: number;
  role: "gm" | "player";
  setCenter: (center: Axial) => void;
  setHoveredHex: (axial: Axial | null) => void;
  showCoordinates: boolean;
  startEditGesture: (action: EditGestureAction, axials: Axial[]) => void;
  startRiverGesture: (action: EditGestureAction, edges: RiverEdgeRef[]) => void;
  visualZoom: number;
  world: MapState;
};

export function useEditorCanvasProps({
  activeMode,
  applyActiveGestureCells,
  applyActiveRiverGestureEdges,
  canEdit,
  center,
  changeVisualZoom,
  featureVisibilityMode,
  finishEditGesture,
  hoveredHex,
  interactionLabel,
  level,
  role,
  setCenter,
  setHoveredHex,
  showCoordinates,
  startEditGesture,
  startRiverGesture,
  visualZoom,
  world
}: UseEditorCanvasPropsOptions): HexCanvasProps {
  return useMemo(
    () => ({
      center,
      canEdit,
      editMode: activeMode,
      featureVisibilityMode,
      fogEditingActive: role === "gm" && activeMode === "fog",
      interactionLabel,
      level,
      onCenterChange: setCenter,
      onEditGestureEnd: finishEditGesture,
      onEditGestureMove: applyActiveGestureCells,
      onEditGestureStart: startEditGesture,
      onRiverGestureEnd: finishEditGesture,
      onRiverGestureMove: applyActiveRiverGestureEdges,
      onRiverGestureStart: startRiverGesture,
      onHoveredHexChange: setHoveredHex,
      onVisualZoomChange: changeVisualZoom,
      hoveredHex,
      showCoordinates,
      visualZoom,
      world
    }),
    [
      activeMode,
      applyActiveGestureCells,
      applyActiveRiverGestureEdges,
      canEdit,
      center,
      changeVisualZoom,
      featureVisibilityMode,
      finishEditGesture,
      hoveredHex,
      interactionLabel,
      level,
      role,
      setCenter,
      setHoveredHex,
      showCoordinates,
      startEditGesture,
      startRiverGesture,
      visualZoom,
      world
    ]
  );
}
