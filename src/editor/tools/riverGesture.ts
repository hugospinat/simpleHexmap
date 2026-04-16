import {
  addRiverEdge,
  getCanonicalRiverEdgeKey,
  removeRiverEdge,
  type RiverEdgeRef,
  type World
} from "@/domain/world/world";

export type RiverGestureAction = "add" | "remove";

export type RiverGesture = {
  action: RiverGestureAction;
  changed: boolean;
  level: number;
  touchedEdgeKeys: Set<string>;
  world: World;
};

export function createRiverGesture(action: RiverGestureAction, world: World, level: number): RiverGesture {
  return {
    action,
    changed: false,
    level,
    touchedEdgeKeys: new Set(),
    world
  };
}

export function applyRiverGestureEdges(gesture: RiverGesture, edges: RiverEdgeRef[]): World {
  for (const edge of edges) {
    const key = getCanonicalRiverEdgeKey(edge);

    if (gesture.touchedEdgeKeys.has(key)) {
      continue;
    }

    gesture.touchedEdgeKeys.add(key);

    const nextWorld =
      gesture.action === "add"
        ? addRiverEdge(gesture.world, gesture.level, edge)
        : removeRiverEdge(gesture.world, gesture.level, edge);

    if (nextWorld !== gesture.world) {
      gesture.world = nextWorld;
      gesture.changed = true;
    }
  }

  return gesture.world;
}

export function getFinishedRiverGestureWorld(gesture: RiverGesture): World | null {
  return gesture.changed ? gesture.world : null;
}
