import {
  getCanonicalRiverEdgeKey,
  type RiverEdgeRef,
  type MapState
} from "@/core/map/world";
import { executeMapEditCommand } from "@/core/map/commands/mapEditCommands";
import {
  applyGestureUpdate,
  createGestureSession,
  type GestureSession
} from "@/editor/tools/gestureSession";

export type RiverGestureAction = "add" | "remove";

export type RiverGesture = GestureSession<RiverGestureAction> & {
  touchedEdgeKeys: Set<string>;
};

export function createRiverGesture(action: RiverGestureAction, world: MapState, level: number): RiverGesture {
  return {
    ...createGestureSession(action, world, level),
    touchedEdgeKeys: new Set(),
  };
}

export function applyRiverGestureEdges(gesture: RiverGesture, edges: RiverEdgeRef[]): MapState {
  for (const edge of edges) {
    const key = getCanonicalRiverEdgeKey(edge);

    if (gesture.touchedEdgeKeys.has(key)) {
      continue;
    }

    gesture.touchedEdgeKeys.add(key);

    applyGestureUpdate(
      gesture,
      executeMapEditCommand(gesture.world, {
        type: "setRiverEdge",
        level: gesture.level,
        ref: edge,
        enabled: gesture.action === "add"
      })
    );
  }

  return gesture.world;
}

