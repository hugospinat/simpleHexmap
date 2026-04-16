import { hexKey, type Axial } from "@/domain/geometry/hex";
import {
  addRoadConnection,
  removeRoadConnectionsAt
} from "@/domain/world/roads";
import type { World } from "@/domain/world/world";

export type RoadGestureAction = "add" | "remove";

export type RoadGesture = {
  action: RoadGestureAction;
  changed: boolean;
  lastAxial: Axial | null;
  level: number;
  touchedKeys: Set<string>;
  world: World;
};

export function createRoadGesture(
  action: RoadGestureAction,
  world: World,
  level: number
): RoadGesture {
  return {
    action,
    changed: false,
    lastAxial: null,
    level,
    touchedKeys: new Set(),
    world
  };
}

export function applyRoadGestureCells(gesture: RoadGesture, axials: Axial[]): World {
  for (const axial of axials) {
    const key = hexKey(axial);

    if (gesture.action === "remove") {
      if (gesture.touchedKeys.has(key)) {
        continue;
      }

      gesture.touchedKeys.add(key);
      const nextWorld = removeRoadConnectionsAt(gesture.world, gesture.level, axial);

      if (nextWorld !== gesture.world) {
        gesture.world = nextWorld;
        gesture.changed = true;
      }

      gesture.lastAxial = axial;
      continue;
    }

    if (!gesture.lastAxial) {
      gesture.lastAxial = axial;
      continue;
    }

    if (hexKey(gesture.lastAxial) === key) {
      continue;
    }

    const nextWorld = addRoadConnection(gesture.world, gesture.level, gesture.lastAxial, axial);

    if (nextWorld !== gesture.world) {
      gesture.world = nextWorld;
      gesture.changed = true;
    }

    gesture.lastAxial = axial;
  }

  return gesture.world;
}

export function getFinishedRoadGestureWorld(gesture: RoadGesture): World | null {
  return gesture.changed ? gesture.world : null;
}
