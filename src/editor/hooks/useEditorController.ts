import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { editorConfig } from "@/config/editorConfig";
import type { EditorMode } from "@/editor/tools/editorTypes";
import type { ViewerRole } from "@/ui/components/MapMenu/MapMenu";
import { useKeyboardNavigation } from "@/editor/hooks/useKeyboardNavigation";
import {
  applyEditGestureCells,
  createEditGesture,
  type EditGesture,
  type EditGestureAction
} from "@/editor/tools/editGesture";
import {
  applyRiverGestureEdges,
  createRiverGesture,
  type RiverGesture
} from "@/editor/tools/riverGesture";
import {
  applyRoadGestureCells,
  createRoadGesture,
  type RoadGesture
} from "@/editor/tools/roadGesture";
import {
  applyFactionGestureCells,
  createFactionGesture,
  type FactionGesture
} from "@/editor/tools/factionGesture";
import {
  applyFogGestureCells,
  createFogGesture,
  type FogGesture
} from "@/editor/tools/fogGesture";
import {
  createFeature,
  getFeatureAt,
  getFeatureById,
  type Feature,
  type FeatureKind
} from "@/core/map/features";
import {
  getFactionById,
  getFactions,
  type RiverEdgeRef,
  type TerrainType,
  type MapState
} from "@/core/map/world";
import { useCamera } from "./useCamera";
import { useAuthoritativeWorld } from "./useAuthoritativeWorld";
import { hexKey, type Axial } from "@/core/geometry/hex";
import { SOURCE_LEVEL } from "@/core/map/mapRules";
import { useMapSocketSync } from "@/app/sync/useMapSocketSync";
import { useFactionControls } from "@/editor/hooks/useFactionControls";
import { useEditorCanvasProps } from "@/editor/hooks/useEditorCanvasProps";
import { getInteractionLabel } from "@/editor/presentation/interactionLabels";
import {
  commandAddFeature,
  commandRemoveFeature,
  commandToggleFeatureHiddenAt,
  commandUpdateFeature
} from "@/core/map/commands/mapEditCommands";
import {
  clearOperationHistory,
  createOperationHistoryState,
  recordOperationHistory,
  takeRedoOperations,
  takeUndoOperations
} from "@/core/map/history/mapOperationHistory";
import type { MapOperation } from "@/core/protocol";

type UseEditorControllerOptions = {
  initialWorld: MapState;
  mapId: string;
  role: ViewerRole;
};

type ActiveEditorGesture =
  | { kind: "terrain"; gesture: EditGesture; worldBefore: MapState }
  | { kind: "faction"; gesture: FactionGesture; worldBefore: MapState }
  | { kind: "river"; gesture: RiverGesture; worldBefore: MapState }
  | { kind: "road"; gesture: RoadGesture; worldBefore: MapState }
  | { kind: "fog"; gesture: FogGesture; worldBefore: MapState };

export function useEditorController({ initialWorld, mapId, role }: UseEditorControllerOptions) {
  const maxLevels = editorConfig.maxLevels;
  const appRef = useRef<HTMLElement | null>(null);
  const { resetFromCurrent, world: authoritativeWorld } = useAuthoritativeWorld<MapState>(() => initialWorld);
  const { changeLevelByDelta, changeVisualZoom, setCenter, view, visualZoom } = useCamera();
  const [gesturePreviewWorld, setGesturePreviewWorld] = useState<MapState | null>(null);
  const [activeMode, setActiveMode] = useState<EditorMode>("terrain");
  const [activeType, setActiveType] = useState<TerrainType>("plain");
  const [activeFeatureKind, setActiveFeatureKind] = useState<FeatureKind>("city");
  const [activeFactionId, setActiveFactionId] = useState<string | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [hoveredHex, setHoveredHex] = useState<Axial | null>(null);
  const activeGestureRef = useRef<ActiveEditorGesture | null>(null);
  const operationHistoryRef = useRef(createOperationHistoryState());
  const featureIdRef = useRef(0);
  const clearGesturePreviewWorld = useCallback(() => {
    setGesturePreviewWorld(null);
  }, []);
  const { sendOperations, syncStatus } = useMapSocketSync({
    clearPreviewWorld: clearGesturePreviewWorld,
    mapId,
    resetWorldFromCurrent: resetFromCurrent
  });

  const world = gesturePreviewWorld ?? authoritativeWorld;
  const canEdit = role === "gm";
  const factions = useMemo(() => getFactions(world), [world]);
  const selectedFaction = useMemo(
    () => activeFactionId ? getFactionById(world, activeFactionId) : null,
    [activeFactionId, world]
  );
  const selectedFeature = useMemo(
    () => selectedFeatureId ? getFeatureById(world, view.level, selectedFeatureId) : null,
    [selectedFeatureId, view.level, world]
  );
  const submitLocalOperations = useCallback(
    (operations: MapOperation[], worldBefore: MapState = authoritativeWorld) => {
      if (operations.length === 0) {
        return;
      }

      recordOperationHistory(operationHistoryRef.current, worldBefore, operations);
      sendOperations(operations);
    },
    [authoritativeWorld, sendOperations]
  );

  const undoLastOperationBatch = useCallback(() => {
    if (!canEdit) {
      return;
    }

    const operations = takeUndoOperations(operationHistoryRef.current);

    if (operations.length > 0) {
      sendOperations(operations);
    }
  }, [canEdit, sendOperations]);

  const redoLastOperationBatch = useCallback(() => {
    if (!canEdit) {
      return;
    }

    const operations = takeRedoOperations(operationHistoryRef.current);

    if (operations.length > 0) {
      sendOperations(operations);
    }
  }, [canEdit, sendOperations]);

  const createFeatureId = useCallback(() => {
    featureIdRef.current += 1;
    return `feature-${Date.now()}-${featureIdRef.current}`;
  }, []);

  useEffect(() => {
    clearOperationHistory(operationHistoryRef.current);
    activeGestureRef.current = null;
    setGesturePreviewWorld(null);
  }, [mapId]);

  const applyTerrainGestureCells = useCallback(
    (axials: Axial[]) => {
      const activeGesture = activeGestureRef.current;
      const gesture = activeGesture?.kind === "terrain" ? activeGesture.gesture : null;

      if (!gesture) {
        return;
      }

      const beforeWorld = gesture.world;
      const nextWorld = applyEditGestureCells(gesture, axials);

      if (nextWorld !== beforeWorld) {
        setGesturePreviewWorld(nextWorld);
      }
    },
    []
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
        const nextWorld = applyFactionGestureCells(activeGesture.gesture, axials);

        if (nextWorld !== beforeWorld) {
          setGesturePreviewWorld(nextWorld);
        }
        return;
      }

      if (activeGesture?.kind === "road") {
        const beforeWorld = activeGesture.gesture.world;
        const nextWorld = applyRoadGestureCells(activeGesture.gesture, axials);

        if (nextWorld !== beforeWorld) {
          setGesturePreviewWorld(nextWorld);
        }
        return;
      }

      if (activeGesture?.kind === "fog") {
        const beforeWorld = activeGesture.gesture.world;
        const nextWorld = applyFogGestureCells(activeGesture.gesture, axials);

        if (nextWorld !== beforeWorld) {
          setGesturePreviewWorld(nextWorld);
        }
      }
    },
    [applyTerrainGestureCells]
  );

  const applyActiveRiverGestureEdges = useCallback(
    (edges: RiverEdgeRef[]) => {
      const activeGesture = activeGestureRef.current;
      const gesture = activeGesture?.kind === "river" ? activeGesture.gesture : null;

      if (!gesture) {
        return;
      }

      const beforeWorld = gesture.world;
      const nextWorld = applyRiverGestureEdges(gesture, edges);

      if (nextWorld !== beforeWorld) {
        setGesturePreviewWorld(nextWorld);
      }
    },
    []
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

        const existingFeature = getFeatureAt(authoritativeWorld, view.level, axial);

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
            authoritativeWorld,
            view.level,
            createFeature(createFeatureId(), activeFeatureKind, hexKey(axial))
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

        const result = commandRemoveFeature(authoritativeWorld, existingFeature.id);
        setSelectedFeatureId(existingFeature.id === selectedFeatureId ? null : selectedFeatureId);

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
            authoritativeWorld,
            view.level
          ),
          worldBefore: authoritativeWorld
        };
        applyActiveGestureCells(axials);
        return;
      }

      if (activeMode === "faction") {
        activeGestureRef.current = {
          kind: "faction",
          gesture: createFactionGesture(
            action === "paint" ? "assign" : "clear",
            authoritativeWorld,
            view.level,
            activeFactionId
          ),
          worldBefore: authoritativeWorld
        };
        applyActiveGestureCells(axials);
        return;
      }

      if (activeMode === "fog") {
        if (action === "paint") {
          activeGestureRef.current = {
            kind: "fog",
            gesture: createFogGesture(authoritativeWorld, view.level),
            worldBefore: authoritativeWorld
          };
          applyActiveGestureCells(axials);
          return;
        }

        const axial = axials[0];

        if (!axial) {
          return;
        }

        const result = commandToggleFeatureHiddenAt(authoritativeWorld, view.level, axial);

        if (result.operations.length > 0) {
          submitLocalOperations(result.operations);
        }

        return;
      }

      activeGestureRef.current = {
        kind: "terrain",
        gesture: createEditGesture(
          action,
          authoritativeWorld,
          view.level,
          activeType
        ),
        worldBefore: authoritativeWorld
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
      authoritativeWorld,
      canEdit,
      selectedFeatureId,
      submitLocalOperations,
      view.level
    ]
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
          authoritativeWorld,
          view.level
        ),
        worldBefore: authoritativeWorld
      };
      applyActiveRiverGestureEdges(edges);
    },
    [applyActiveRiverGestureEdges, canEdit, authoritativeWorld, view.level]
  );

  const finishEditGesture = useCallback(() => {
    const activeGesture = activeGestureRef.current;
    activeGestureRef.current = null;
    setGesturePreviewWorld(null);

    const operations = activeGesture?.gesture.operations ?? [];

    if (operations.length > 0) {
      submitLocalOperations(operations, activeGesture?.worldBefore);
    }
  }, [submitLocalOperations]);

  const chooseFeatureKind = useCallback((type: FeatureKind) => {
    if (!canEdit) {
      return;
    }

    setActiveFeatureKind(type);
    setActiveMode("feature");
  }, [canEdit]);

  const changeMode = useCallback((mode: EditorMode) => {
    if (!canEdit) {
      return;
    }

    setActiveMode(mode);

    if (mode !== "feature") {
      setSelectedFeatureId(null);
    }
  }, [canEdit]);

  const clearSelectedFeature = useCallback(() => {
    setSelectedFeatureId(null);
  }, []);

  const updateSelectedFeature = useCallback(
    (
      updates: Partial<
        Pick<Feature, "gmLabel" | "hidden" | "kind" | "labelRevealed" | "overrideTerrainTile" | "playerLabel">
      >
    ) => {
      if (!canEdit || !selectedFeatureId) {
        return;
      }

      const result = commandUpdateFeature(authoritativeWorld, view.level, selectedFeatureId, updates);

      if (result.operations.length > 0) {
        submitLocalOperations(result.operations);
      }
    },
    [canEdit, authoritativeWorld, selectedFeatureId, submitLocalOperations, view.level]
  );

  const deleteSelectedFeature = useCallback(() => {
    if (!canEdit) {
      return;
    }

    if (!selectedFeature) {
      return;
    }

    if (view.level !== SOURCE_LEVEL) {
      setSelectedFeatureId(null);
      return;
    }

    const result = commandRemoveFeature(authoritativeWorld, selectedFeature.id);

    if (result.operations.length > 0) {
      submitLocalOperations(result.operations);
    }

    setSelectedFeatureId(null);
  }, [canEdit, authoritativeWorld, selectedFeature, submitLocalOperations, view.level]);

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

  const {
    createFaction,
    deleteFaction,
    recolorFaction,
    renameFaction
  } = useFactionControls({
    activeFactionId,
    canEdit,
    factionCount: factions.length,
    presentWorld: authoritativeWorld,
    sendOperations: submitLocalOperations,
    setActiveFactionId,
    setActiveMode
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
    onUndo: undoLastOperationBatch
  });

  const interactionLabel = useMemo(() => getInteractionLabel({
    activeFactionId,
    activeFeatureKind,
    activeMode,
    activeType,
    canEdit,
    level: view.level,
    selectedFaction
  }), [activeFactionId, activeFeatureKind, activeMode, activeType, canEdit, selectedFaction, view.level]);
  const featureVisibilityMode: "gm" | "player" = role === "player" ? "player" : "gm";

  const canvasProps = useEditorCanvasProps({
    activeMode,
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
    role,
    setCenter,
    setHoveredHex,
    showCoordinates,
    startEditGesture,
    startRiverGesture,
    visualZoom,
    world
  });

  return {
    activeFeatureKind,
    activeFactionId,
    activeMode,
    activeType,
    factions,
    hoveredHex,
    selectedFeature,
    appRef,
    canvasProps,
    chooseFeatureKind,
    clearSelectedFeature,
    deleteSelectedFeature,
    deleteFaction,
    maxLevels,
    selectedFeatureId,
    createFaction,
    renameFaction,
    recolorFaction,
    selectFaction: setActiveFactionId,
    setActiveMode: changeMode,
    setActiveType,
    syncStatus,
    updateSelectedFeature,
    view,
    visualZoom
  };
}
