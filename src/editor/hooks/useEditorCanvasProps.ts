import { useMemo } from "react";
import type { Axial } from "@/core/geometry/hex";
import type { RiverEdgeRef, MapState } from "@/core/map/world";
import type { FeatureVisibilityMode } from "@/core/map/features";
import { isSourceLevel } from "@/core/map/mapRules";
import type { EditGestureAction, EditorMode } from "@/editor/tools";
import type { MapCanvasProps } from "@/ui/components";
import type { RenderWorldPatch } from "@/render/renderWorldPatch";
import type { MapDocument, MapOperation, MapTokenPlacement } from "@/core/protocol";

export function shouldShowFogVisibilityOverlay(
  activeMode: EditorMode,
  role: "gm" | "player",
): boolean {
  return role === "gm" && (activeMode === "fog" || activeMode === "token");
}

export function resolveNoteLabelsForCanvas(
  notes: readonly MapDocument["notes"][number][],
  level: number,
  role: "gm" | "player",
  fogEditingActive: boolean,
): MapCanvasProps["noteLabels"] {
  if (!isSourceLevel(level)) {
    return [];
  }

  return notes.flatMap((note) => {
    const text = role === "player"
      ? note.playerTitle
      : fogEditingActive
        ? note.playerTitle
        : note.gmTitle;

    return text && text.trim()
      ? [{ q: note.q, r: note.r, text: text.trim() }]
      : [];
  });
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
  visibleDocument: MapDocument;
  onToolStep?: (delta: 1 | -1) => void;
  role: "gm" | "player";
  renderWorldPatch?: RenderWorldPatch;
  selectedHex: Axial | null;
  setCenter: (center: Axial) => void;
  setHoveredHex: (axial: Axial | null) => void;
  onGmTokenPlace: (axial: Axial) => void;
  onGmTokenRemove: (userId: string) => void;
  onNoteHexSelect: (axial: Axial) => void;
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
  visibleDocument,
  onToolStep,
  role,
  renderWorldPatch,
  selectedHex,
  setCenter,
  setHoveredHex,
  onGmTokenPlace,
  onGmTokenRemove,
  onNoteHexSelect,
  onPlayerTokenPlace,
  showCoordinates,
  startEditGesture,
  startRiverGesture,
  visualZoom,
  world,
}: UseEditorCanvasPropsOptions): MapCanvasProps {
  return useMemo(
    () => {
      const fogEditingActive = shouldShowFogVisibilityOverlay(activeMode, role);
      const noteLabels = resolveNoteLabelsForCanvas(
        visibleDocument.notes,
        level,
        role,
        fogEditingActive,
      );

      return {
        activeTokenUserId,
        center,
        canEdit,
        playerMode: role === "player",
        editMode: activeMode,
        featureVisibilityMode,
        fogEditingActive,
        interactionLabel,
        level,
        noteLabels,
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
        onNoteHexSelect,
        onPlayerTokenPlace,
        onToolStep,
        onRenderWorldPatchApplied,
        onVisualZoomChange: changeVisualZoom,
        previewOperations,
        tokenPlacements,
        renderWorldPatch,
        hoveredHex,
        selectedHex,
        showCoordinates,
        visualZoom,
        world,
      };
    },
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
      onNoteHexSelect,
      onPlayerTokenPlace,
      onToolStep,
      previewOperations,
      tokenPlacements,
      visibleDocument.notes,
      role,
      renderWorldPatch,
      selectedHex,
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
