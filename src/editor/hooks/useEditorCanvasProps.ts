import { useMemo } from "react";
import type { Axial } from "@/core/geometry/hex";
import type { RiverEdgeRef, MapState } from "@/core/map/world";
import type { FeatureVisibilityMode } from "@/core/map/features";
import type { EditGestureAction, EditorMode } from "@/editor/tools";
import type { MapCanvasProps } from "@/ui/components";
import type { RenderWorldPatch } from "@/render/renderWorldPatch";
import type { MapOperation, MapTokenPlacement } from "@/core/protocol";

export function shouldShowFogVisibilityOverlay(
  activeMode: EditorMode,
  role: "gm" | "player",
): boolean {
  return role === "gm" && (activeMode === "fog" || activeMode === "token");
}

type UseEditorCanvasPropsOptions = {
  activeMode: EditorMode;
  activeTokenUserId: string | null;
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
  tokenPlacements: MapTokenPlacement[];
  onToolStep?: (delta: 1 | -1) => void;
  role: "gm" | "player";
  renderWorldPatch?: RenderWorldPatch;
  setCenter: (center: Axial) => void;
  setHoveredHex: (axial: Axial | null) => void;
  onGmTokenPlace: (axial: Axial) => void;
  onGmTokenRemove: (userId: string) => void;
  onPlayerTokenPlace: (axial: Axial) => void;
  showCoordinates: boolean;
  startEditGesture: (action: EditGestureAction, axials: Axial[]) => void;
  startRiverGesture: (action: EditGestureAction, edges: RiverEdgeRef[]) => void;
  visualZoom: number;
  world: MapState;
};

export function useEditorCanvasProps({
  activeMode,
  activeTokenUserId,
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
  tokenPlacements,
  onToolStep,
  role,
  renderWorldPatch,
  setCenter,
  setHoveredHex,
  onGmTokenPlace,
  onGmTokenRemove,
  onPlayerTokenPlace,
  showCoordinates,
  startEditGesture,
  startRiverGesture,
  visualZoom,
  world,
}: UseEditorCanvasPropsOptions): MapCanvasProps {
  return useMemo(
    () => ({
      activeTokenUserId,
      center,
      canEdit,
      playerMode: role === "player",
      editMode: activeMode,
      featureVisibilityMode,
      fogEditingActive: shouldShowFogVisibilityOverlay(activeMode, role),
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
      onGmTokenPlace,
      onGmTokenRemove,
      onPlayerTokenPlace,
      onToolStep,
      onRenderWorldPatchApplied,
      onVisualZoomChange: changeVisualZoom,
      previewOperations,
      tokenPlacements,
      renderWorldPatch,
      hoveredHex,
      showCoordinates,
      visualZoom,
      world,
    }),
    [
      activeMode,
      activeTokenUserId,
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
      onGmTokenPlace,
      onGmTokenRemove,
      onPlayerTokenPlace,
      onToolStep,
      previewOperations,
      tokenPlacements,
      role,
      renderWorldPatch,
      setCenter,
      setHoveredHex,
      showCoordinates,
      startEditGesture,
      startRiverGesture,
      visualZoom,
      world,
    ],
  );
}
