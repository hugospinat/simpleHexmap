import { hexKey, type Axial } from "@/domain/geometry/hex";
import { assignFactionAt, clearFactionAt, type World } from "@/domain/world/world";

export type FactionGestureAction = "assign" | "clear";

export type FactionGesture = {
  action: FactionGestureAction;
  changed: boolean;
  factionId: string | null;
  level: number;
  touchedKeys: Set<string>;
  world: World;
};

export function createFactionGesture(
  action: FactionGestureAction,
  world: World,
  level: number,
  factionId: string | null
): FactionGesture {
  return {
    action,
    changed: false,
    factionId,
    level,
    touchedKeys: new Set(),
    world
  };
}

export function applyFactionGestureCells(gesture: FactionGesture, axials: Axial[]): World {
  for (const axial of axials) {
    const key = hexKey(axial);

    if (gesture.touchedKeys.has(key)) {
      continue;
    }

    gesture.touchedKeys.add(key);

    const nextWorld = gesture.action === "assign"
      ? gesture.factionId
        ? assignFactionAt(gesture.world, gesture.level, axial, gesture.factionId)
        : gesture.world
      : clearFactionAt(gesture.world, gesture.level, axial);

    if (nextWorld !== gesture.world) {
      gesture.world = nextWorld;
      gesture.changed = true;
    }
  }

  return gesture.world;
}

export function getFinishedFactionGestureWorld(gesture: FactionGesture): World | null {
  return gesture.changed ? gesture.world : null;
}
