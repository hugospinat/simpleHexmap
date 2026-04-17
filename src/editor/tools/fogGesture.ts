import { hexKey, type Axial } from "@/domain/geometry/hex";
import { getLevelMap, type World } from "@/domain/world/world";
import { executeMapCommand } from "@/editor/commands/mapEditCommands";
import {
  applyGestureUpdate,
  createGestureSession,
  finishGestureSession,
  type GestureCommit,
  type GestureSession
} from "@/editor/tools/gestureSession";

export type FogGesture = GestureSession<"toggle">;

export function createFogGesture(world: World, level: number): FogGesture {
  return createGestureSession("toggle", world, level);
}

export function applyFogGestureCells(gesture: FogGesture, axials: Axial[]): World {
  for (const axial of axials) {
    const key = hexKey(axial);

    if (gesture.touchedKeys.has(key)) {
      continue;
    }

    gesture.touchedKeys.add(key);
    const cell = getLevelMap(gesture.world, gesture.level).get(key);

    if (!cell) {
      continue;
    }

    applyGestureUpdate(
      gesture,
      executeMapCommand(gesture.world, {
        type: "setCellHidden",
        level: gesture.level,
        axial,
        hidden: !cell.hidden
      })
    );
  }

  return gesture.world;
}

export function finishFogGesture(gesture: FogGesture): GestureCommit {
  return finishGestureSession(gesture);
}
