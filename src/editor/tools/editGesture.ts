import { hexKey, type Axial } from "@/domain/geometry/hex";
import type { TerrainType, World } from "@/domain/world/world";
import { eraseTile, paintTile } from "./editorActions";

export type EditGestureAction = "paint" | "erase";

export type EditGesture = {
  action: EditGestureAction;
  changed: boolean;
  level: number;
  maxLevels: number;
  touchedKeys: Set<string>;
  type: TerrainType;
  world: World;
};

export function createEditGesture(
  action: EditGestureAction,
  world: World,
  level: number,
  type: TerrainType,
  maxLevels: number
): EditGesture {
  return {
    action,
    changed: false,
    level,
    maxLevels,
    touchedKeys: new Set(),
    type,
    world
  };
}

export function applyEditGestureCells(gesture: EditGesture, axials: Axial[]): World {
  for (const axial of axials) {
    const key = hexKey(axial);

    if (gesture.touchedKeys.has(key)) {
      continue;
    }

    gesture.touchedKeys.add(key);

    const nextWorld =
      gesture.action === "paint"
        ? paintTile(gesture.world, gesture.level, axial, gesture.type, gesture.maxLevels)
        : eraseTile(gesture.world, gesture.level, axial, gesture.maxLevels);

    if (nextWorld !== gesture.world) {
      gesture.world = nextWorld;
      gesture.changed = true;
    }
  }

  return gesture.world;
}

export function getFinishedGestureWorld(gesture: EditGesture): World | null {
  return gesture.changed ? gesture.world : null;
}
