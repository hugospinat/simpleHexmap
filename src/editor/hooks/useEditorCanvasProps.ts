import { useMemo } from "react";
import type { Axial } from "@/core/geometry/hex";
import type { RiverEdgeRef, MapState } from "@/core/map/world";
import type { FeatureVisibilityMode } from "@/core/map/features";
import type { EditGestureAction } from "@/editor/tools/editGesture";
import type { EditorMode } from "@/editor/tools/editorTypes";
import type { MapCanvasProps } from "@/ui/components/MapCanvas/types";
import type { RenderWorldPatch } from "@/render/renderWorldPatch";
import type { MapOperation } from "@/core/protocol";

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
  onRenderWorldPatchApplied?: (revision: number) => void;
  previewOperations: MapOperation[];
  role: "gm" | "player";
  renderWorldPatch?: RenderWorldPatch;
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
  onRenderWorldPatchApplied,
  previewOperations,
  role,
  renderWorldPatch,
  setCenter,
  setHoveredHex,
  showCoordinates,
  startEditGesture,
  startRiverGesture,
  visualZoom,
  world
}: UseEditorCanvasPropsOptions): MapCanvasProps {
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
      onRenderWorldPatchApplied,
      onVisualZoomChange: changeVisualZoom,
      previewOperations,
      renderWorldPatch,
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
      onRenderWorldPatchApplied,
      previewOperations,
      role,
      renderWorldPatch,
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
