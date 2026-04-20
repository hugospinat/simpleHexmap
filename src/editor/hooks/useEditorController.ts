import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { editorConfig } from "@/config/editorConfig";
import { editorModeOrder, type EditorMode } from "@/editor/tools/editorTypes";
import { useKeyboardNavigation } from "@/editor/hooks/useKeyboardNavigation";
import {
  applyEditGestureCells,
  createEditGesture,
  type EditGesture,
  type EditGestureAction,
} from "@/editor/tools/editGesture";
import {
  applyRiverGestureEdges,
  createRiverGesture,
  type RiverGesture,
} from "@/editor/tools/riverGesture";
import {
  applyRoadGestureCells,
  createRoadGesture,
  type RoadGesture,
} from "@/editor/tools/roadGesture";
import {
  applyFactionGestureCells,
  createFactionGesture,
  type FactionGesture,
} from "@/editor/tools/factionGesture";
import {
  applyFogGestureCells,
  createFogGesture,
  type FogGesture,
} from "@/editor/tools/fogGesture";
import {
  createFeature,
  getFeatureAt,
  getFeatureById,
  type Feature,
  type FeatureKind,
} from "@/core/map/features";
import {
  getFactionById,
  getFactions,
  getLevelMap,
  type RiverEdgeRef,
  type TerrainType,
  type MapState,
} from "@/core/map/world";
import { useCamera } from "./useCamera";
import { hexKey, type Axial } from "@/core/geometry/hex";
import { SOURCE_LEVEL } from "@/core/map/mapRules";
import { useMapSocketSync } from "@/app/sync/useMapSocketSync";
import { useFactionControls } from "@/editor/hooks/useFactionControls";
import { useEditorCanvasProps } from "@/editor/hooks/useEditorCanvasProps";
import { useTokenControls } from "@/editor/hooks/useTokenControls";
import { getInteractionLabel } from "@/editor/presentation/interactionLabels";
import {
  commandAddFeature,
  commandRemoveFeature,
  commandUpdateFeature,
} from "@/core/map/commands/mapEditCommands";
import {
  clearOperationHistory,
  createOperationHistoryState,
  recordOperationHistory,
  takeRedoOperations,
  takeUndoOperations,
} from "@/core/map/history/mapOperationHistory";
import type { MapOperation } from "@/core/protocol";
import type {
  MapOpenMode,
  UserRecord,
  WorkspaceMember,
} from "@/core/auth/authTypes";

type UseEditorControllerOptions = {
  initialWorld: MapState;
  mapId: string;
  profile: UserRecord;
  role: MapOpenMode;
  workspaceMembers: WorkspaceMember[];
};

type ActiveEditorGesture =
  | { kind: "terrain"; gesture: EditGesture; worldBefore: MapState }
  | { kind: "faction"; gesture: FactionGesture; worldBefore: MapState }
  | { kind: "river"; gesture: RiverGesture; worldBefore: MapState }
  | { kind: "road"; gesture: RoadGesture; worldBefore: MapState }
  | { kind: "fog"; gesture: FogGesture; worldBefore: MapState };

export function useEditorController({
  initialWorld,
  mapId,
  profile,
  role,
  workspaceMembers: initialWorkspaceMembers,
}: UseEditorControllerOptions) {
  const maxLevels = editorConfig.maxLevels;
  const appRef = useRef<HTMLElement | null>(null);
  const { changeLevelByDelta, changeVisualZoom, setCenter, view, visualZoom } =
    useCamera();
  const [toolPreviewOperations, setToolPreviewOperations] = useState<
    MapOperation[]
  >([]);
  const [activeMode, setActiveMode] = useState<EditorMode>("terrain");
  const [activeType, setActiveType] = useState<TerrainType>("plain");
  const [activeFeatureKind, setActiveFeatureKind] =
    useState<FeatureKind>("city");
  const [activeFactionId, setActiveFactionId] = useState<string | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(
    null,
  );
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [hoveredHex, setHoveredHex] = useState<Axial | null>(null);
  const activeGestureRef = useRef<ActiveEditorGesture | null>(null);
  const operationHistoryRef = useRef(createOperationHistoryState());
  const featureIdRef = useRef(0);
  const publishToolPreviewOperations = useCallback(
    (operations: MapOperation[]) => {
      if (operations.length === 0) {
        return;
      }

      setToolPreviewOperations((previous) => [...previous, ...operations]);
    },
    [],
  );
  const clearToolPreview = useCallback(() => {
    // Keep local paint preview stable while a pointer gesture is still active.
    if (activeGestureRef.current) {
      return;
    }

    setToolPreviewOperations([]);
  }, []);
  const clearUndoRedoHistory = useCallback(() => {
    clearOperationHistory(operationHistoryRef.current);
  }, []);
  const handleAuthoritativeResync = useCallback(() => {
    clearUndoRedoHistory();
    activeGestureRef.current = null;
    setToolPreviewOperations([]);
  }, [clearUndoRedoHistory]);
  const {
    acknowledgeRenderWorldPatch,
    commitLocalOperations,
    tokenPlacements,
    renderWorldPatch,
    sendTokenOperation,
    syncStatus,
    workspaceMembers,
    visibleWorld,
  } = useMapSocketSync({
    clearPreview: clearToolPreview,
    initialWorld,
    mapId,
    onAuthoritativeResync: handleAuthoritativeResync,
    onRemoteOperationsApplied: clearUndoRedoHistory,
    userId: profile.id,
    initialWorkspaceMembers,
  });
  const {
    activeTokenUserId,
    clearMapTokenSelection,
    placePlayerToken,
    placeSelectedMapToken,
    playerTokenColor,
    removeMapToken,
    selectWorkspaceMember,
    setPlayerTokenColor,
  } = useTokenControls({
    canEdit: role === "gm",
    mapId,
    mapTokens: tokenPlacements,
    userId: profile.id,
    role,
    sendTokenOperation,
    viewLevel: view.level,
    visibleWorld,
  });

  const world = visibleWorld;
  const canEdit = role === "gm";
  const factions = useMemo(() => getFactions(world), [world]);
  const selectedFaction = useMemo(
    () => (activeFactionId ? getFactionById(world, activeFactionId) : null),
    [activeFactionId, world],
  );
  const selectedFeature = useMemo(
    () =>
      selectedFeatureId
        ? getFeatureById(world, view.level, selectedFeatureId)
        : null,
    [selectedFeatureId, view.level, world],
  );
  const submitLocalOperations = useCallback(
    (operations: MapOperation[], worldBefore: MapState = visibleWorld) => {
      if (operations.length === 0) {
        return;
      }

      recordOperationHistory(
        operationHistoryRef.current,
        worldBefore,
        operations,
      );
      commitLocalOperations(operations);
    },
    [commitLocalOperations, visibleWorld],
  );

  const undoLastOperationBatch = useCallback(() => {
    if (!canEdit) {
      return;
    }

    const operations = takeUndoOperations(operationHistoryRef.current);

    if (operations.length > 0) {
      commitLocalOperations(operations);
    }
  }, [canEdit, commitLocalOperations]);
  const redoLastOperationBatch = useCallback(() => {
    if (!canEdit) {
      return;
    }

    const operations = takeRedoOperations(operationHistoryRef.current);

    if (operations.length > 0) {
      commitLocalOperations(operations);
    }
  }, [canEdit, commitLocalOperations]);

  const createFeatureId = useCallback(() => {
    featureIdRef.current += 1;
    return `feature-${Date.now()}-${featureIdRef.current}`;
  }, []);

  useEffect(() => {
    clearOperationHistory(operationHistoryRef.current);
    activeGestureRef.current = null;
    setToolPreviewOperations([]);
  }, [mapId]);

  const applyTerrainGestureCells = useCallback(
    (axials: Axial[]) => {
      const activeGesture = activeGestureRef.current;
      const gesture =
        activeGesture?.kind === "terrain" ? activeGesture.gesture : null;

      if (!gesture) {
        return;
      }

      const beforeWorld = gesture.world;
      const operationStartIndex = gesture.operations.length;
      const nextWorld = applyEditGestureCells(gesture, axials);

      if (nextWorld !== beforeWorld) {
        publishToolPreviewOperations(
          gesture.operations.slice(operationStartIndex),
        );
      }
    },
    [publishToolPreviewOperations],
  );

  const applyActiveGestureCells = useCallback(
    (axials: Axial[]) => {
      const activeGesture = activeGestureRef.current;

      if (activeGesture?.kind === "terrain") {
        applyTerrainGestureCells(axials);
        return;
      }

      if (activeGesture?.kind === "faction") {
        const beforeWorld = activeGesture.gesture.world;
        const operationStartIndex = activeGesture.gesture.operations.length;
        const nextWorld = applyFactionGestureCells(
          activeGesture.gesture,
          axials,
        );

        if (nextWorld !== beforeWorld) {
          publishToolPreviewOperations(
            activeGesture.gesture.operations.slice(operationStartIndex),
          );
        }
        return;
      }

      if (activeGesture?.kind === "road") {
        const beforeWorld = activeGesture.gesture.world;
        const operationStartIndex = activeGesture.gesture.operations.length;
        const nextWorld = applyRoadGestureCells(activeGesture.gesture, axials);

        if (nextWorld !== beforeWorld) {
          publishToolPreviewOperations(
            activeGesture.gesture.operations.slice(operationStartIndex),
          );
        }
        return;
      }

      if (activeGesture?.kind === "fog") {
        const beforeWorld = activeGesture.gesture.world;
        const operationStartIndex = activeGesture.gesture.operations.length;
        const nextWorld = applyFogGestureCells(activeGesture.gesture, axials);

        if (nextWorld !== beforeWorld) {
          publishToolPreviewOperations(
            activeGesture.gesture.operations.slice(operationStartIndex),
          );
        }
      }
    },
    [applyTerrainGestureCells, publishToolPreviewOperations],
  );

  const applyActiveRiverGestureEdges = useCallback(
    (edges: RiverEdgeRef[]) => {
      const activeGesture = activeGestureRef.current;
      const gesture =
        activeGesture?.kind === "river" ? activeGesture.gesture : null;

      if (!gesture) {
        return;
      }

      const beforeWorld = gesture.world;
      const operationStartIndex = gesture.operations.length;
      const nextWorld = applyRiverGestureEdges(gesture, edges);

      if (nextWorld !== beforeWorld) {
        publishToolPreviewOperations(
          gesture.operations.slice(operationStartIndex),
        );
      }
    },
    [publishToolPreviewOperations],
  );

  const startEditGesture = useCallback(
    (action: EditGestureAction, axials: Axial[]) => {
      if (!canEdit) {
        return;
      }

      activeGestureRef.current = null;

      if (activeMode === "feature") {
        const axial = axials[0];

        if (!axial) {
          setSelectedFeatureId(null);
          return;
        }

        const existingFeature = getFeatureAt(visibleWorld, view.level, axial);

        if (action === "paint") {
          if (existingFeature) {
            setSelectedFeatureId(existingFeature.id);
            return;
          }

          setSelectedFeatureId(null);

          if (view.level !== SOURCE_LEVEL) {
            return;
          }

          const result = commandAddFeature(
            visibleWorld,
            view.level,
            createFeature(createFeatureId(), activeFeatureKind, hexKey(axial)),
          );

          if (result.operations.length > 0) {
            submitLocalOperations(result.operations);
          }

          return;
        }

        if (!existingFeature) {
          setSelectedFeatureId(null);
          return;
        }

        if (view.level !== SOURCE_LEVEL) {
          setSelectedFeatureId(existingFeature.id);
          return;
        }

        const result = commandRemoveFeature(visibleWorld, existingFeature.id);
        setSelectedFeatureId(
          existingFeature.id === selectedFeatureId ? null : selectedFeatureId,
        );

        if (result.operations.length > 0) {
          submitLocalOperations(result.operations);
        }

        return;
      }

      if (activeMode === "river") {
        return;
      }

      if (activeMode === "road") {
        if (view.level !== SOURCE_LEVEL) {
          return;
        }

        activeGestureRef.current = {
          kind: "road",
          gesture: createRoadGesture(
            action === "paint" ? "add" : "remove",
            visibleWorld,
            view.level,
          ),
          worldBefore: visibleWorld,
        };
        applyActiveGestureCells(axials);
        return;
      }

      if (activeMode === "faction") {
        activeGestureRef.current = {
          kind: "faction",
          gesture: createFactionGesture(
            action === "paint" ? "assign" : "clear",
            visibleWorld,
            view.level,
            activeFactionId,
          ),
          worldBefore: visibleWorld,
        };
        applyActiveGestureCells(axials);
        return;
      }

      if (activeMode === "fog") {
        const initialAxial = axials[0];

        if (!initialAxial) {
          return;
        }

        activeGestureRef.current = {
          kind: "fog",
          gesture: createFogGesture(
            action === "paint" ? "paint" : "erase",
            visibleWorld,
            view.level,
            initialAxial,
          ),
          worldBefore: visibleWorld,
        };
        applyActiveGestureCells(axials);
        return;
      }

      activeGestureRef.current = {
        kind: "terrain",
        gesture: createEditGesture(
          action,
          visibleWorld,
          view.level,
          activeType,
        ),
        worldBefore: visibleWorld,
      };
      applyActiveGestureCells(axials);
    },
    [
      activeFeatureKind,
      activeFactionId,
      activeMode,
      activeType,
      applyActiveGestureCells,
      createFeatureId,
      visibleWorld,
      canEdit,
      selectedFeatureId,
      submitLocalOperations,
      view.level,
    ],
  );

  const startRiverGesture = useCallback(
    (action: EditGestureAction, edges: RiverEdgeRef[]) => {
      if (!canEdit) {
        return;
      }

      activeGestureRef.current = null;

      if (view.level !== SOURCE_LEVEL) {
        return;
      }

      activeGestureRef.current = {
        kind: "river",
        gesture: createRiverGesture(
          action === "paint" ? "add" : "remove",
          visibleWorld,
          view.level,
        ),
        worldBefore: visibleWorld,
      };
      applyActiveRiverGestureEdges(edges);
    },
    [applyActiveRiverGestureEdges, canEdit, visibleWorld, view.level],
  );

  const finishEditGesture = useCallback(() => {
    const activeGesture = activeGestureRef.current;
    activeGestureRef.current = null;
    setToolPreviewOperations([]);

    const operations = activeGesture?.gesture.operations ?? [];

    if (operations.length > 0) {
      submitLocalOperations(operations, activeGesture?.worldBefore);
    }
  }, [submitLocalOperations]);

  const chooseFeatureKind = useCallback(
    (type: FeatureKind) => {
      if (!canEdit) {
        return;
      }

      setActiveFeatureKind(type);
      setActiveMode("feature");
    },
    [canEdit],
  );

  const changeMode = useCallback(
    (mode: EditorMode) => {
      if (!canEdit) {
        return;
      }

      setActiveMode(mode);

      if (mode !== "feature") {
        setSelectedFeatureId(null);
      }
    },
    [canEdit],
  );

  const changeToolByDelta = useCallback(
    (delta: 1 | -1) => {
      if (!canEdit) {
        return;
      }

      const currentIndex = editorModeOrder.indexOf(activeMode);
      const nextIndex =
        (currentIndex + delta + editorModeOrder.length) %
        editorModeOrder.length;
      changeMode(editorModeOrder[nextIndex]);
    },
    [activeMode, canEdit, changeMode],
  );

  const clearSelectedFeature = useCallback(() => {
    setSelectedFeatureId(null);
  }, []);

  const updateSelectedFeatureLabels = useCallback(
    (updates: Partial<Pick<Feature, "gmLabel" | "hidden" | "playerLabel">>) => {
      if (!canEdit || !selectedFeatureId) {
        return;
      }

      const result = commandUpdateFeature(
        visibleWorld,
        view.level,
        selectedFeatureId,
        updates,
      );

      if (result.operations.length > 0) {
        submitLocalOperations(result.operations);
      }
    },
    [
      canEdit,
      visibleWorld,
      selectedFeatureId,
      submitLocalOperations,
      view.level,
    ],
  );

  useEffect(() => {
    if (selectedFeatureId && !selectedFeature) {
      setSelectedFeatureId(null);
    }
  }, [selectedFeature, selectedFeatureId]);

  useEffect(() => {
    if (activeFactionId && !selectedFaction) {
      setActiveFactionId(null);
    }
  }, [activeFactionId, selectedFaction]);

  const toggleCoordinates = useCallback(() => {
    setShowCoordinates((previous) => !previous);
  }, []);

  const { createFaction, deleteFaction, recolorFaction, renameFaction } =
    useFactionControls({
      activeFactionId,
      canEdit,
      commitLocalOperations: submitLocalOperations,
      factionCount: factions.length,
      presentWorld: visibleWorld,
      setActiveFactionId,
      setActiveMode,
    });

  useKeyboardNavigation({
    center: view.center,
    level: view.level,
    panPixelsPerSecond: editorConfig.keyboardPanPixelsPerSecond,
    rootRef: appRef,
    visualZoom,
    onCenterChange: setCenter,
    onLevelStep: changeLevelByDelta,
    onRedo: redoLastOperationBatch,
    onToggleCoordinates: toggleCoordinates,
    onUndo: undoLastOperationBatch,
  });

  const interactionLabel = useMemo(
    () =>
      getInteractionLabel({
        activeFactionId,
        activeFeatureKind,
        activeMode,
        activeTokenUserId,
        activeType,
        canEdit,
        level: view.level,
        selectedFaction,
      }),
    [
      activeFactionId,
      activeFeatureKind,
      activeMode,
      activeTokenUserId,
      activeType,
      canEdit,
      selectedFaction,
      view.level,
    ],
  );
  const featureVisibilityMode: "gm" | "player" =
    role === "player" ? "player" : "gm";

  const canvasProps = useEditorCanvasProps({
    activeMode,
    activeTokenUserId,
    applyActiveGestureCells,
    applyActiveRiverGestureEdges,
    canEdit,
    center: view.center,
    changeVisualZoom,
    featureVisibilityMode,
    finishEditGesture,
    hoveredHex,
    interactionLabel,
    level: view.level,
    onRenderWorldPatchApplied: acknowledgeRenderWorldPatch,
    previewOperations: toolPreviewOperations,
    tokenPlacements,
    onToolStep: canEdit ? changeToolByDelta : undefined,
    role,
    renderWorldPatch,
    setCenter,
    setHoveredHex,
    onGmTokenPlace: placeSelectedMapToken,
    onGmTokenRemove: removeMapToken,
    onPlayerTokenPlace: placePlayerToken,
    showCoordinates,
    startEditGesture,
    startRiverGesture,
    visualZoom,
    world,
  });

  return {
    activeFeatureKind,
    activeFactionId,
    activeMode,
    activeTokenUserId,
    activeType,
    factions,
    hoveredHex,
    tokenPlacements,
    workspaceMembers,
    playerTokenColor,
    selectedFeature,
    appRef,
    canvasProps,
    chooseFeatureKind,
    clearSelectedFeature,
    deleteFaction,
    maxLevels,
    selectedFeatureId,
    createFaction,
    renameFaction,
    recolorFaction,
    selectFaction: setActiveFactionId,
    clearMapTokenSelection,
    selectWorkspaceMember,
    setPlayerTokenColor,
    setActiveMode: changeMode,
    setActiveType,
    syncStatus,
    redoLastOperationBatch,
    updateSelectedFeatureLabels,
    undoLastOperationBatch,
    view,
    visualZoom,
  };
}
