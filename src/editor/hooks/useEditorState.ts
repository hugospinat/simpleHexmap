import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { editorConfig } from "@/config/editorConfig";
import type { EditorMode } from "@/editor/tools/editorTypes";
import { useKeyboardNavigation } from "@/editor/hooks/useKeyboardNavigation";
import {
  placeOrSelectFeature,
  removeFeatureOnHex
} from "@/editor/tools/featureActions";
import {
  applyEditGestureCells,
  createEditGesture,
  getFinishedGestureWorld,
  type EditGesture,
  type EditGestureAction
} from "@/editor/tools/editGesture";
import {
  applyRiverGestureEdges,
  createRiverGesture,
  getFinishedRiverGestureWorld,
  type RiverGesture
} from "@/editor/tools/riverGesture";
import {
  applyRoadGestureCells,
  createRoadGesture,
  getFinishedRoadGestureWorld,
  type RoadGesture
} from "@/editor/tools/roadGesture";
import {
  featureHexIdToAxial,
  getFeatureById,
  updateFeature,
  featureKindLabels,
  type Feature,
  type FeatureKind
} from "@/domain/world/features";
import {
  createInitialWorld,
  type RiverEdgeRef,
  type TerrainType,
  type World
} from "@/domain/world/world";
import { tileLabels } from "@/domain/rendering/tileVisuals";
import { useCamera } from "./useCamera";
import { useUndoRedo } from "./useUndoRedo";
import type { Axial } from "@/domain/geometry/hex";

export function useEditorState() {
  const maxLevels = editorConfig.maxLevels;
  const appRef = useRef<HTMLElement | null>(null);
  const { history, record, redo, undo } = useUndoRedo<World>(() => createInitialWorld(maxLevels));
  const { changeVisualZoom, setCenter, view, visualZoom } = useCamera();
  const [draftWorld, setDraftWorld] = useState<World | null>(null);
  const [activeMode, setActiveMode] = useState<EditorMode>("terrain");
  const [activeType, setActiveType] = useState<TerrainType>("plain");
  const [activeFeatureKind, setActiveFeatureKind] = useState<FeatureKind>("city");
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [hoveredHex, setHoveredHex] = useState<Axial | null>(null);
  const editGestureRef = useRef<EditGesture | null>(null);
  const riverGestureRef = useRef<RiverGesture | null>(null);
  const roadGestureRef = useRef<RoadGesture | null>(null);
  const featureIdRef = useRef(0);

  const world = draftWorld ?? history.present;
  const selectedFeature = useMemo(
    () => selectedFeatureId ? getFeatureById(world, view.level, selectedFeatureId) : null,
    [selectedFeatureId, view.level, world]
  );

  const createFeatureId = useCallback(() => {
    featureIdRef.current += 1;
    return `feature-${Date.now()}-${featureIdRef.current}`;
  }, []);

  const applyTerrainGestureCells = useCallback(
    (axials: Axial[]) => {
      const gesture = editGestureRef.current;

      if (!gesture) {
        return;
      }

      const beforeWorld = gesture.world;
      const nextWorld = applyEditGestureCells(gesture, axials);

      if (nextWorld !== beforeWorld) {
        setDraftWorld(nextWorld);
      }
    },
    []
  );

  const applyActiveGestureCells = useCallback(
    (axials: Axial[]) => {
      if (editGestureRef.current) {
        applyTerrainGestureCells(axials);
      }

      const roadGesture = roadGestureRef.current;

      if (!roadGesture) {
        return;
      }

      const beforeWorld = roadGesture.world;
      const nextWorld = applyRoadGestureCells(roadGesture, axials);

      if (nextWorld !== beforeWorld) {
        setDraftWorld(nextWorld);
      }
    },
    [applyTerrainGestureCells]
  );

  const applyActiveRiverGestureEdges = useCallback(
    (edges: RiverEdgeRef[]) => {
      const gesture = riverGestureRef.current;

      if (!gesture) {
        return;
      }

      const beforeWorld = gesture.world;
      const nextWorld = applyRiverGestureEdges(gesture, edges);

      if (nextWorld !== beforeWorld) {
        setDraftWorld(nextWorld);
      }
    },
    []
  );

  const startEditGesture = useCallback(
    (action: EditGestureAction, axials: Axial[]) => {
      editGestureRef.current = null;
      riverGestureRef.current = null;
      roadGestureRef.current = null;

      if (activeMode === "feature") {
        const axial = axials[0];

        if (!axial) {
          setSelectedFeatureId(null);
          return;
        }

        const result = action === "paint"
          ? placeOrSelectFeature(history.present, view.level, axial, activeFeatureKind, createFeatureId)
          : removeFeatureOnHex(history.present, view.level, axial, selectedFeatureId);

        setSelectedFeatureId(result.selectedFeatureId);

        if (result.world !== history.present) {
          record(result.world);
        }

        return;
      }

      if (activeMode === "river") {
        return;
      }

      if (activeMode === "road") {
        if (view.level !== 3) {
          return;
        }

        roadGestureRef.current = createRoadGesture(
          action === "paint" ? "add" : "remove",
          history.present,
          view.level
        );
        applyActiveGestureCells(axials);
        return;
      }

      editGestureRef.current = createEditGesture(
        action,
        history.present,
        view.level,
        activeType,
        maxLevels
      );
      applyActiveGestureCells(axials);
    },
    [
      activeFeatureKind,
      activeMode,
      activeType,
      applyActiveGestureCells,
      createFeatureId,
      history.present,
      maxLevels,
      record,
      selectedFeatureId,
      view.level
    ]
  );

  const startRiverGesture = useCallback(
    (action: EditGestureAction, edges: RiverEdgeRef[]) => {
      editGestureRef.current = null;
      roadGestureRef.current = null;

      if (view.level !== 3) {
        return;
      }

      riverGestureRef.current = createRiverGesture(
        action === "paint" ? "add" : "remove",
        history.present,
        view.level
      );
      applyActiveRiverGestureEdges(edges);
    },
    [applyActiveRiverGestureEdges, history.present, view.level]
  );

  const finishEditGesture = useCallback(() => {
    const terrainGesture = editGestureRef.current;
    const riverGesture = riverGestureRef.current;
    const roadGesture = roadGestureRef.current;
    editGestureRef.current = null;
    riverGestureRef.current = null;
    roadGestureRef.current = null;
    setDraftWorld(null);

    if (terrainGesture) {
      const finishedWorld = getFinishedGestureWorld(terrainGesture);

      if (finishedWorld) {
        record(finishedWorld);
      }
    }

    if (riverGesture) {
      const finishedWorld = getFinishedRiverGestureWorld(riverGesture);

      if (finishedWorld) {
        record(finishedWorld);
      }
    }

    if (roadGesture) {
      const finishedWorld = getFinishedRoadGestureWorld(roadGesture);

      if (finishedWorld) {
        record(finishedWorld);
      }
    }
  }, [record]);

  const chooseFeatureKind = useCallback((type: FeatureKind) => {
    setActiveFeatureKind(type);
    setActiveMode("feature");
  }, []);

  const changeMode = useCallback((mode: EditorMode) => {
    setActiveMode(mode);

    if (mode !== "feature") {
      setSelectedFeatureId(null);
    }
  }, []);

  const clearSelectedFeature = useCallback(() => {
    setSelectedFeatureId(null);
  }, []);

  const updateSelectedFeature = useCallback(
    (
      updates: Partial<
        Pick<Feature, "gmLabel" | "hidden" | "kind" | "labelRevealed" | "overrideTerrainTile" | "playerLabel">
      >
    ) => {
      if (!selectedFeatureId) {
        return;
      }

      const nextWorld = updateFeature(history.present, view.level, selectedFeatureId, updates);

      if (nextWorld !== history.present) {
        record(nextWorld);
      }
    },
    [history.present, record, selectedFeatureId, view.level]
  );

  const deleteSelectedFeature = useCallback(() => {
    if (!selectedFeature) {
      return;
    }

    const nextWorld = removeFeatureOnHex(
      history.present,
      view.level,
      featureHexIdToAxial(selectedFeature.hexId),
      selectedFeatureId
    ).world;

    if (nextWorld !== history.present) {
      record(nextWorld);
    }

    setSelectedFeatureId(null);
  }, [history.present, record, selectedFeature, selectedFeatureId, view.level]);

  useEffect(() => {
    if (selectedFeatureId && !selectedFeature) {
      setSelectedFeatureId(null);
    }
  }, [selectedFeature, selectedFeatureId]);

  const toggleCoordinates = useCallback(() => {
    setShowCoordinates((previous) => !previous);
  }, []);

  useKeyboardNavigation({
    center: view.center,
    level: view.level,
    panPixelsPerSecond: editorConfig.keyboardPanPixelsPerSecond,
    rootRef: appRef,
    visualZoom,
    onCenterChange: setCenter,
    onRedo: redo,
    onToggleCoordinates: toggleCoordinates,
    onUndo: undo
  });

  const interactionLabel = useMemo(() => {
    if (activeMode === "terrain") {
      return `Left paints ${tileLabels[activeType]}, right erases terrain, middle drag pans.`;
    }

    if (activeMode === "feature") {
      if (view.level !== 3) {
        return `Left selects derived ${featureKindLabels[activeFeatureKind]} features, metadata edits update level 3 sources.`;
      }

      return `Left places ${featureKindLabels[activeFeatureKind]} or selects an existing feature, right removes a feature, middle drag pans.`;
    }

    if (activeMode === "road") {
      if (view.level !== 3) {
        return "Roads are derived here. Zoom to level 3 to edit road edges.";
      }

      return "Left click and drag to draw roads, right click a road to remove it, middle drag pans.";
    }

    if (view.level !== 3) {
      return "Rivers are derived here. Zoom to level 3 to edit river edges.";
    }

    return "Left paints river edges, right erases river edges, middle drag pans.";
  }, [activeFeatureKind, activeMode, activeType, view.level]);

  const canvasProps = useMemo(
    () => ({
      center: view.center,
      editMode: activeMode,
      interactionLabel,
      level: view.level,
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
      changeVisualZoom,
      finishEditGesture,
      interactionLabel,
      setCenter,
      hoveredHex,
      showCoordinates,
      startEditGesture,
      startRiverGesture,
      view.center,
      view.level,
      visualZoom,
      world
    ]
  );

  return {
    activeFeatureKind,
    activeMode,
    activeType,
    hoveredHex,
    selectedFeature,
    appRef,
    canvasProps,
    chooseFeatureKind,
    clearSelectedFeature,
    deleteSelectedFeature,
    maxLevels,
    selectedFeatureId,
    setActiveMode: changeMode,
    setActiveType,
    updateSelectedFeature,
    view,
    visualZoom
  };
}
