import { hexKey, type Axial } from "@/domain/geometry/hex";
import type { World } from "@/domain/world/world";
import {
  executeMapCommand
} from "@/editor/commands/mapEditCommands";
import {
  applyGestureUpdate,
  createGestureSession,
  finishGestureSession,
  type GestureSession
} from "@/editor/tools/gestureSession";

export type RoadGestureAction = "add" | "remove";

export type RoadGesture = GestureSession<RoadGestureAction> & {
  lastAxial: Axial | null;
};

export function createRoadGesture(
  action: RoadGestureAction,
  world: World,
  level: number
): RoadGesture {
  return {
    ...createGestureSession(action, world, level),
    lastAxial: null,
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
      applyGestureUpdate(
        gesture,
        executeMapCommand(gesture.world, {
          type: "removeRoadConnectionsAt",
          level: gesture.level,
          axial
        })
      );

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

    applyGestureUpdate(
      gesture,
      executeMapCommand(gesture.world, {
        type: "addRoadConnection",
        level: gesture.level,
        from: gesture.lastAxial,
        to: axial
      })
    );

    gesture.lastAxial = axial;
  }

  return gesture.world;
}

export function getFinishedRoadGestureWorld(gesture: RoadGesture): World | null {
  return finishGestureSession(gesture).previewWorld;
}
