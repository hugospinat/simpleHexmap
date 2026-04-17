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
  applyFactionGestureCells,
  createFactionGesture,
  getFinishedFactionGestureWorld,
  type FactionGesture
} from "@/editor/tools/factionGesture";
import {
  featureHexIdToAxial,
  getFeatureById,
  updateFeature,
  featureKindLabels,
  type Feature,
  type FeatureKind
} from "@/domain/world/features";
import {
  addFaction,
  getFactionById,
  getFactions,
  removeFaction,
  updateFaction,
  type Faction,
  type RiverEdgeRef,
  type TerrainType,
  type World
} from "@/domain/world/world";
import { tileLabels } from "@/domain/rendering/tileVisuals";
import { useCamera } from "./useCamera";
import { useUndoRedo } from "./useUndoRedo";
import type { Axial } from "@/domain/geometry/hex";

const defaultFactionColors = [
  "#d94f3d",
  "#3668d8",
  "#2f9d5a",
  "#b76ad8",
  "#d89f2f",
  "#1fa9a3"
];

type UseEditorStateOptions = {
  initialWorld: World;
  onSaveMap: (world: World) => Promise<void>;
};

export function useEditorState({ initialWorld, onSaveMap }: UseEditorStateOptions) {
  const maxLevels = editorConfig.maxLevels;
  const appRef = useRef<HTMLElement | null>(null);
  const { history, record, redo, undo } = useUndoRedo<World>(() => initialWorld);
  const { changeLevelByDelta, changeVisualZoom, setCenter, view, visualZoom } = useCamera();
  const [draftWorld, setDraftWorld] = useState<World | null>(null);
  const [activeMode, setActiveMode] = useState<EditorMode>("terrain");
  const [activeType, setActiveType] = useState<TerrainType>("plain");
  const [activeFeatureKind, setActiveFeatureKind] = useState<FeatureKind>("city");
  const [activeFactionId, setActiveFactionId] = useState<string | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [hoveredHex, setHoveredHex] = useState<Axial | null>(null);
  const editGestureRef = useRef<EditGesture | null>(null);
  const factionGestureRef = useRef<FactionGesture | null>(null);
  const riverGestureRef = useRef<RiverGesture | null>(null);
  const roadGestureRef = useRef<RoadGesture | null>(null);
  const featureIdRef = useRef(0);
  const factionIdRef = useRef(0);

  const world = draftWorld ?? history.present;
  const factions = useMemo(() => getFactions(world), [world]);
  const selectedFaction = useMemo(
    () => activeFactionId ? getFactionById(world, activeFactionId) : null,
    [activeFactionId, world]
  );
  const selectedFeature = useMemo(
    () => selectedFeatureId ? getFeatureById(world, view.level, selectedFeatureId) : null,
    [selectedFeatureId, view.level, world]
  );

  const createFeatureId = useCallback(() => {
    featureIdRef.current += 1;
    return `feature-${Date.now()}-${featureIdRef.current}`;
  }, []);

  const createFactionId = useCallback(() => {
    factionIdRef.current += 1;
    return `faction-${Date.now()}-${factionIdRef.current}`;
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

      const factionGesture = factionGestureRef.current;

      if (factionGesture) {
        const beforeWorld = factionGesture.world;
        const nextWorld = applyFactionGestureCells(factionGesture, axials);

        if (nextWorld !== beforeWorld) {
          setDraftWorld(nextWorld);
        }
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
      factionGestureRef.current = null;
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

      if (activeMode === "faction") {
        factionGestureRef.current = createFactionGesture(
          action === "paint" ? "assign" : "clear",
          history.present,
          view.level,
          activeFactionId
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
      activeFactionId,
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
      factionGestureRef.current = null;
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
    const factionGesture = factionGestureRef.current;
    const riverGesture = riverGestureRef.current;
    const roadGesture = roadGestureRef.current;
    editGestureRef.current = null;
    factionGestureRef.current = null;
    riverGestureRef.current = null;
    roadGestureRef.current = null;
    setDraftWorld(null);

    if (terrainGesture) {
      const finishedWorld = getFinishedGestureWorld(terrainGesture);

      if (finishedWorld) {
        record(finishedWorld);
      }
    }

    if (factionGesture) {
      const finishedWorld = getFinishedFactionGestureWorld(factionGesture);

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

  useEffect(() => {
    if (activeFactionId && !selectedFaction) {
      setActiveFactionId(null);
    }
  }, [activeFactionId, selectedFaction]);

  const toggleCoordinates = useCallback(() => {
    setShowCoordinates((previous) => !previous);
  }, []);

  const saveCurrentMap = useCallback(async () => {
    try {
      await onSaveMap(world);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save map.";
      console.error(error);
      window.alert(message);
    }
  }, [onSaveMap, world]);

  const createNewFaction = useCallback(() => {
    const factionNumber = factions.length + 1;
    const nextFaction: Faction = {
      id: createFactionId(),
      name: `Faction ${factionNumber}`,
      color: defaultFactionColors[(factionNumber - 1) % defaultFactionColors.length]
    };
    const nextWorld = addFaction(history.present, nextFaction);

    if (nextWorld !== history.present) {
      record(nextWorld);
      setActiveFactionId(nextFaction.id);
      setActiveMode("faction");
    }
  }, [createFactionId, factions.length, history.present, record]);

  const renameFaction = useCallback((factionId: string, name: string) => {
    const trimmed = name.trim();

    if (!trimmed) {
      return;
    }

    const nextWorld = updateFaction(history.present, factionId, { name: trimmed });

    if (nextWorld !== history.present) {
      record(nextWorld);
    }
  }, [history.present, record]);

  const recolorFaction = useCallback((factionId: string, color: string) => {
    const nextWorld = updateFaction(history.present, factionId, { color });

    if (nextWorld !== history.present) {
      record(nextWorld);
    }
  }, [history.present, record]);

  const deleteFactionById = useCallback((factionId: string) => {
    const nextWorld = removeFaction(history.present, factionId);

    if (nextWorld !== history.present) {
      record(nextWorld);
    }

    if (activeFactionId === factionId) {
      setActiveFactionId(null);
    }
  }, [activeFactionId, history.present, record]);

  useKeyboardNavigation({
    center: view.center,
    level: view.level,
    panPixelsPerSecond: editorConfig.keyboardPanPixelsPerSecond,
    rootRef: appRef,
    visualZoom,
    onCenterChange: setCenter,
    onLevelStep: changeLevelByDelta,
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

    if (activeMode === "faction") {
      if (!activeFactionId) {
        return "Select a faction first. Left assigns hexes, right clears faction marks, middle drag pans.";
      }

      const name = selectedFaction?.name ?? "selected faction";
      return `Left assigns ${name}, right clears faction marks, middle drag pans.`;
    }

    if (activeMode === "road") {
      if (view.level !== 3) {
        return "Roads are derived here. Use A/E to switch to level 3 and edit road edges.";
      }

      return "Left click and drag to draw roads, right click a road to remove it, middle drag pans.";
    }

    if (view.level !== 3) {
      return "Rivers are derived here. Use A/E to switch to level 3 and edit river edges.";
    }

    return "Left paints river edges, right erases river edges, middle drag pans.";
  }, [activeFactionId, activeFeatureKind, activeMode, activeType, selectedFaction, view.level]);

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
    deleteFaction: deleteFactionById,
    maxLevels,
    selectedFeatureId,
    createFaction: createNewFaction,
    renameFaction,
    recolorFaction,
    selectFaction: setActiveFactionId,
    onSaveMap: saveCurrentMap,
    setActiveMode: changeMode,
    setActiveType,
    updateSelectedFeature,
    view,
    visualZoom
  };
}
