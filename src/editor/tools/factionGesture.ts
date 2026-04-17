import { hexKey, type Axial } from "@/core/geometry/hex";
import type { MapState } from "@/core/map/world";
import { executeMapEditCommand } from "@/core/map/commands/mapEditCommands";
import {
  applyGestureUpdate,
  createGestureSession,
  finishGestureSession,
  type GestureSession
} from "@/editor/tools/gestureSession";

export type FactionGestureAction = "assign" | "clear";

export type FactionGesture = GestureSession<FactionGestureAction> & {
  factionId: string | null;
};

export function createFactionGesture(
  action: FactionGestureAction,
  world: MapState,
  level: number,
  factionId: string | null
): FactionGesture {
  return {
    ...createGestureSession(action, world, level),
    factionId,
  };
}

export function applyFactionGestureCells(gesture: FactionGesture, axials: Axial[]): MapState {
  for (const axial of axials) {
    const key = hexKey(axial);

    if (gesture.touchedKeys.has(key)) {
      continue;
    }

    gesture.touchedKeys.add(key);

    if (gesture.action === "assign" && !gesture.factionId) {
      continue;
    }

    applyGestureUpdate(
      gesture,
      executeMapEditCommand(
        gesture.world,
        gesture.action === "assign"
          ? { type: "assignFaction", level: gesture.level, axial, factionId: gesture.factionId! }
          : { type: "clearFaction", level: gesture.level, axial }
      )
    );
  }

  return gesture.world;
}

export function getFinishedFactionGestureWorld(gesture: FactionGesture): MapState | null {
  return finishGestureSession(gesture).previewWorld;
}
