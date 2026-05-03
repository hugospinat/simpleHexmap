import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { editorConfig } from "@/config/editorConfig";
import { useMapSocketSync } from "@/app/sync";
import { getFactionById, getFactions, type MapState } from "@/core/map/world";
import type { MapOperation } from "@/core/protocol";
import type {
  MapOpenMode,
  UserRecord,
  WorkspaceMember,
} from "@/core/auth/authTypes";
import { useCamera } from "./useCamera";
import { useEditorCanvasProps } from "./useEditorCanvasProps";
import { useEditorGestureController } from "./useEditorGestureController";
import { useEditorOperationHistory } from "./useEditorOperationHistory";
import { useEditorToolState } from "./useEditorToolState";
import { useFactionControls } from "./useFactionControls";
import { useKeyboardNavigation } from "./useKeyboardNavigation";
import { useTokenControls } from "./useTokenControls";
import { getInteractionLabel } from "@/editor/presentation/interactionLabels";

type UseEditorControllerOptions = {
  initialWorld: MapState;
  mapId: string;
  profile: UserRecord;
  role: MapOpenMode;
  workspaceMembers: WorkspaceMember[];
};

export function useEditorController({
  initialWorld,
  mapId,
  profile,
  role,
  workspaceMembers: initialWorkspaceMembers,
}: UseEditorControllerOptions) {
  const maxLevels = editorConfig.maxLevels;
  const appRef = useRef<HTMLElement | null>(null);
  const featureIdRef = useRef(0);
  const { changeLevelByDelta, changeVisualZoom, setCenter, view, visualZoom } =
    useCamera();
  const [toolPreviewOperations, setToolPreviewOperations] = useState<
    MapOperation[]
  >([]);
  const clearPreviewHandlerRef = useRef<() => void>(() => {
    setToolPreviewOperations([]);
  });
  const authoritativeResyncHandlerRef = useRef<() => void>(() => {});
  const remoteOperationsAppliedHandlerRef = useRef<(count: number) => void>(
    () => {},
  );
  const canEdit = role === "gm";
  const toolState = useEditorToolState(canEdit);

  const createFeatureId = useCallback(() => {
    featureIdRef.current += 1;
    return `feature-${Date.now()}-${featureIdRef.current}`;
  }, []);

  const clearToolPreview = useCallback((force = false) => {
    if (!force) {
      return;
    }

    setToolPreviewOperations([]);
  }, []);

  const handleToolPreviewOperations = useCallback((operations: MapOperation[]) => {
    if (operations.length === 0) {
      return;
    }

    setToolPreviewOperations((previous) => [...previous, ...operations]);
  }, []);

  const syncState = useMapSocketSync({
    clearPreview: () => clearPreviewHandlerRef.current(),
    initialWorld,
    mapId,
    onAuthoritativeResync: () => authoritativeResyncHandlerRef.current(),
    onRemoteOperationsApplied: (count) =>
      remoteOperationsAppliedHandlerRef.current(count),
    userId: profile.id,
    initialWorkspaceMembers,
  });

  const {
    acknowledgeRenderWorldPatch: acknowledgePatch,
    commitLocalOperations: commitOperations,
    tokenPlacements: activeTokenPlacements,
    renderWorldPatch: activeRenderWorldPatch,
    sendTokenOperation: dispatchTokenOperation,
    syncStatus: currentSyncStatus,
    workspaceMembers: currentWorkspaceMembers,
    visibleWorld: world,
  } = syncState;

  const operationHistory = useEditorOperationHistory(canEdit, commitOperations);
  const editorGestures = useEditorGestureController({
    activeFactionId: toolState.activeFactionId,
    activeFeatureKind: toolState.activeFeatureKind,
    activeMode: toolState.activeMode,
    activeType: toolState.activeType,
    canEdit,
    createFeatureId,
    publishToolPreviewOperations: handleToolPreviewOperations,
    submitLocalOperations: operationHistory.submitLocalOperations,
    viewLevel: view.level,
    visibleWorld: world,
  });

  useEffect(() => {
    clearPreviewHandlerRef.current = () => {
      if (editorGestures.hasActiveGesture()) {
        return;
      }

      clearToolPreview(true);
    };
    authoritativeResyncHandlerRef.current = () => {
      operationHistory.resetHistory();
      editorGestures.resetGestureState();
      clearToolPreview(true);
    };
    remoteOperationsAppliedHandlerRef.current = () => {
      operationHistory.clearUndoRedoHistory();
    };
  }, [clearToolPreview, editorGestures, operationHistory]);

  const tokenControls = useTokenControls({
    canEdit,
    mapId,
    mapTokens: activeTokenPlacements,
    userId: profile.id,
    role,
    sendTokenOperation: dispatchTokenOperation,
    viewLevel: view.level,
    visibleWorld: world,
  });

  const factions = useMemo(() => getFactions(world), [world]);
  const selectedFaction = useMemo(
    () =>
      toolState.activeFactionId ? getFactionById(world, toolState.activeFactionId) : null,
    [toolState.activeFactionId, world],
  );

  useEffect(() => {
    operationHistory.resetHistory();
    editorGestures.resetGestureState();
    clearToolPreview(true);
  }, [clearToolPreview, editorGestures, mapId, operationHistory]);

  useEffect(() => {
    if (toolState.activeFactionId && !selectedFaction) {
      toolState.setActiveFactionId(null);
    }
  }, [selectedFaction, toolState]);

  const submitVisibleWorldOperations = useCallback(
    (operations: MapOperation[]) => {
      operationHistory.submitLocalOperations(operations, world);
    },
    [operationHistory, world],
  );

  const { createFaction, deleteFaction, recolorFaction, renameFaction } =
    useFactionControls({
      activeFactionId: toolState.activeFactionId,
      canEdit,
      commitLocalOperations: submitVisibleWorldOperations,
      factionCount: factions.length,
      presentWorld: world,
      setActiveFactionId: toolState.setActiveFactionId,
      setActiveMode: toolState.setActiveMode,
    });

  useKeyboardNavigation({
    center: view.center,
    level: view.level,
    panPixelsPerSecond: editorConfig.keyboardPanPixelsPerSecond,
    rootRef: appRef,
    visualZoom,
    onCenterChange: setCenter,
    onLevelStep: changeLevelByDelta,
    onRedo: operationHistory.redoLastOperationBatch,
    onToggleCoordinates: toolState.toggleCoordinates,
    onUndo: operationHistory.undoLastOperationBatch,
  });

  const interactionLabel = useMemo(
    () =>
      getInteractionLabel({
        activeFactionId: toolState.activeFactionId,
        activeFeatureKind: toolState.activeFeatureKind,
        activeMode: toolState.activeMode,
        activeTokenUserId: tokenControls.activeTokenUserId,
        activeType: toolState.activeType,
        canEdit,
        level: view.level,
        selectedFaction,
      }),
    [
      canEdit,
      selectedFaction,
      tokenControls.activeTokenUserId,
      toolState.activeFactionId,
      toolState.activeFeatureKind,
      toolState.activeMode,
      toolState.activeType,
      view.level,
    ],
  );

  const featureVisibilityMode: "gm" | "player" = role === "player" ? "player" : "gm";

  const canvasProps = useEditorCanvasProps({
    activeMode: toolState.activeMode,
    activeTokenUserId: tokenControls.activeTokenUserId,
    applyActiveGestureCells: editorGestures.applyActiveGestureCells,
    applyActiveRiverGestureEdges: editorGestures.applyActiveRiverGestureEdges,
    canEdit,
    center: view.center,
    changeVisualZoom,
    featureVisibilityMode,
    finishEditGesture: () => {
      editorGestures.finishEditGesture();
      clearToolPreview(true);
    },
    hoveredHex: toolState.hoveredHex,
    interactionLabel,
    level: view.level,
    onRenderWorldPatchApplied: acknowledgePatch,
    previewOperations: toolPreviewOperations,
    tokenPlacements: activeTokenPlacements,
    onToolStep: canEdit ? toolState.changeToolByDelta : undefined,
    role,
    renderWorldPatch: activeRenderWorldPatch,
    setCenter,
    setHoveredHex: toolState.setHoveredHex,
    onGmTokenPlace: tokenControls.placeSelectedMapToken,
    onGmTokenRemove: tokenControls.removeMapToken,
    onPlayerTokenPlace: tokenControls.placePlayerToken,
    showCoordinates: toolState.showCoordinates,
    startEditGesture: editorGestures.startEditGesture,
    startRiverGesture: editorGestures.startRiverGesture,
    visualZoom,
    world,
  });

  return {
    activeFeatureKind: toolState.activeFeatureKind,
    activeFactionId: toolState.activeFactionId,
    activeMode: toolState.activeMode,
    activeTokenUserId: tokenControls.activeTokenUserId,
    activeType: toolState.activeType,
    factions,
    hoveredHex: toolState.hoveredHex,
    tokenPlacements: activeTokenPlacements,
    workspaceMembers: currentWorkspaceMembers,
    playerTokenColor: tokenControls.playerTokenColor,
    appRef,
    canvasProps,
    chooseFeatureKind: toolState.chooseFeatureKind,
    deleteFaction,
    maxLevels,
    createFaction,
    renameFaction,
    recolorFaction,
    selectFaction: toolState.setActiveFactionId,
    clearMapTokenSelection: tokenControls.clearMapTokenSelection,
    selectWorkspaceMember: tokenControls.selectWorkspaceMember,
    setPlayerTokenColor: tokenControls.setPlayerTokenColor,
    setActiveMode: toolState.setActiveMode,
    setActiveType: toolState.setActiveType,
    syncStatus: currentSyncStatus,
    redoLastOperationBatch: operationHistory.redoLastOperationBatch,
    undoLastOperationBatch: operationHistory.undoLastOperationBatch,
    view,
    visualZoom,
  };
}
