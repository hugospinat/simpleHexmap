import { useCallback, useMemo, useRef } from "react";
import { hexKey, type Axial } from "@/core/geometry/hex";
import {
  createFeature,
  getFeatureAt,
  type FeatureKind,
} from "@/core/map/features";
import { SOURCE_LEVEL } from "@/core/map/mapRules";
import type { MapState, RiverEdgeRef, TerrainType } from "@/core/map/world";
import {
  commandAddFeature,
  commandRemoveFeature,
} from "@/core/map/commands/mapEditCommands";
import type { MapDocument, MapOperation } from "@/core/protocol";
import {
  applyEditGestureCells,
  createEditGesture,
  type EditGesture,
  type EditGestureAction,
} from "@/editor/tools/editGesture";
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
  applyRiverGestureEdges,
  createRiverGesture,
  type RiverGesture,
} from "@/editor/tools/riverGesture";
import {
  applyRoadGestureCells,
  createRoadGesture,
  type RoadGesture,
} from "@/editor/tools/roadGesture";
import type { EditorMode } from "@/editor/tools";

type ActiveEditorGesture =
  | { kind: "terrain"; gesture: EditGesture; worldBefore: MapState; documentBefore: MapDocument }
  | { kind: "faction"; gesture: FactionGesture; worldBefore: MapState; documentBefore: MapDocument }
  | { kind: "river"; gesture: RiverGesture; worldBefore: MapState; documentBefore: MapDocument }
  | { kind: "road"; gesture: RoadGesture; worldBefore: MapState; documentBefore: MapDocument }
  | { kind: "fog"; gesture: FogGesture; worldBefore: MapState; documentBefore: MapDocument };

type UseEditorGestureControllerOptions = {
  activeFactionId: string | null;
  activeFeatureKind: FeatureKind;
  activeMode: EditorMode;
  activeType: TerrainType;
  canEdit: boolean;
  createFeatureId: () => string;
  publishToolPreviewOperations: (operations: MapOperation[]) => void;
  submitLocalOperations: (
    operations: MapOperation[],
    worldBefore: MapState,
    documentBefore: MapDocument,
  ) => void;
  viewLevel: number;
  visibleDocument: MapDocument;
  visibleWorld: MapState;
};

export function useEditorGestureController({
  activeFactionId,
  activeFeatureKind,
  activeMode,
  activeType,
  canEdit,
  createFeatureId,
  publishToolPreviewOperations,
  submitLocalOperations,
  viewLevel,
  visibleDocument,
  visibleWorld,
}: UseEditorGestureControllerOptions) {
  const activeGestureRef = useRef<ActiveEditorGesture | null>(null);

  const resetGestureState = useCallback(() => {
    activeGestureRef.current = null;
  }, []);

  const hasActiveGesture = useCallback(() => activeGestureRef.current !== null, []);

  const applyTerrainGestureCells = useCallback(
    (axials: Axial[]) => {
      const activeGesture = activeGestureRef.current;
      const gesture = activeGesture?.kind === "terrain" ? activeGesture.gesture : null;

      if (!gesture) {
        return;
      }

      const beforeWorld = gesture.world;
      const operationStartIndex = gesture.operations.length;
      const nextWorld = applyEditGestureCells(gesture, axials);

      if (nextWorld !== beforeWorld) {
        publishToolPreviewOperations(gesture.operations.slice(operationStartIndex));
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
        const nextWorld = applyFactionGestureCells(activeGesture.gesture, axials);

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
      const gesture = activeGesture?.kind === "river" ? activeGesture.gesture : null;

      if (!gesture) {
        return;
      }

      const beforeWorld = gesture.world;
      const operationStartIndex = gesture.operations.length;
      const nextWorld = applyRiverGestureEdges(gesture, edges);

      if (nextWorld !== beforeWorld) {
        publishToolPreviewOperations(gesture.operations.slice(operationStartIndex));
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

        if (!axial || viewLevel !== SOURCE_LEVEL) {
          return;
        }

        const existingFeature = getFeatureAt(visibleWorld, viewLevel, axial);

        if (action === "paint") {
          if (existingFeature) {
            return;
          }

          const result = commandAddFeature(
            visibleWorld,
            viewLevel,
            createFeature(createFeatureId(), activeFeatureKind, hexKey(axial)),
          );

          submitLocalOperations(result.operations, visibleWorld, visibleDocument);
          return;
        }

        if (!existingFeature) {
          return;
        }

        const result = commandRemoveFeature(visibleWorld, existingFeature.id);
        submitLocalOperations(result.operations, visibleWorld, visibleDocument);
        return;
      }

      if (activeMode === "river") {
        return;
      }

      if (activeMode === "road") {
        if (viewLevel !== SOURCE_LEVEL) {
          return;
        }

        activeGestureRef.current = {
          kind: "road",
          gesture: createRoadGesture(
            action === "paint" ? "add" : "remove",
            visibleWorld,
            viewLevel,
          ),
          documentBefore: visibleDocument,
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
            viewLevel,
            activeFactionId,
          ),
          documentBefore: visibleDocument,
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
            viewLevel,
            initialAxial,
          ),
          documentBefore: visibleDocument,
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
          viewLevel,
          activeType,
        ),
        documentBefore: visibleDocument,
        worldBefore: visibleWorld,
      };
      applyActiveGestureCells(axials);
    },
    [
      activeFactionId,
      activeFeatureKind,
      activeMode,
      activeType,
      applyActiveGestureCells,
      canEdit,
      createFeatureId,
      submitLocalOperations,
      visibleDocument,
      viewLevel,
      visibleWorld,
    ],
  );

  const startRiverGesture = useCallback(
    (action: EditGestureAction, edges: RiverEdgeRef[]) => {
      if (!canEdit) {
        return;
      }

      activeGestureRef.current = null;

      if (viewLevel !== SOURCE_LEVEL) {
        return;
      }

      activeGestureRef.current = {
        kind: "river",
        gesture: createRiverGesture(
          action === "paint" ? "add" : "remove",
          visibleWorld,
          viewLevel,
        ),
        documentBefore: visibleDocument,
        worldBefore: visibleWorld,
      };
      applyActiveRiverGestureEdges(edges);
    },
    [applyActiveRiverGestureEdges, canEdit, viewLevel, visibleDocument, visibleWorld],
  );

  const finishEditGesture = useCallback(() => {
    const activeGesture = activeGestureRef.current;
    activeGestureRef.current = null;

    const operations = activeGesture?.gesture.operations ?? [];

    if (operations.length > 0 && activeGesture) {
      submitLocalOperations(
        operations,
        activeGesture.worldBefore,
        activeGesture.documentBefore,
      );
    }
  }, [submitLocalOperations]);

  return useMemo(
    () => ({
      applyActiveGestureCells,
      applyActiveRiverGestureEdges,
      finishEditGesture,
      hasActiveGesture,
      resetGestureState,
      startEditGesture,
      startRiverGesture,
    }),
    [
      applyActiveGestureCells,
      applyActiveRiverGestureEdges,
      finishEditGesture,
      hasActiveGesture,
      resetGestureState,
      startEditGesture,
      startRiverGesture,
    ],
  );
}
