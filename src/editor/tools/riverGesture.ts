import {
  getCanonicalRiverEdgeKey,
  type RiverEdgeRef,
  type World
} from "@/domain/world/world";
import { executeMapCommand } from "@/editor/commands/mapEditCommands";
import {
  applyGestureUpdate,
  createGestureSession,
  finishGestureSession,
  type GestureSession
} from "@/editor/tools/gestureSession";

export type RiverGestureAction = "add" | "remove";

export type RiverGesture = GestureSession<RiverGestureAction> & {
  touchedEdgeKeys: Set<string>;
};

export function createRiverGesture(action: RiverGestureAction, world: World, level: number): RiverGesture {
  return {
    ...createGestureSession(action, world, level),
    touchedEdgeKeys: new Set(),
  };
}

export function applyRiverGestureEdges(gesture: RiverGesture, edges: RiverEdgeRef[]): World {
  for (const edge of edges) {
    const key = getCanonicalRiverEdgeKey(edge);

    if (gesture.touchedEdgeKeys.has(key)) {
      continue;
    }

    gesture.touchedEdgeKeys.add(key);

    applyGestureUpdate(
      gesture,
      executeMapCommand(gesture.world, {
        type: "setRiverEdge",
        level: gesture.level,
        ref: edge,
        enabled: gesture.action === "add"
      })
    );
  }

  return gesture.world;
}

export function getFinishedRiverGestureWorld(gesture: RiverGesture): World | null {
  return finishGestureSession(gesture).previewWorld;
}
