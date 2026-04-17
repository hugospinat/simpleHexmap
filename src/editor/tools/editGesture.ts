import { hexKey, type Axial } from "@/domain/geometry/hex";
import type { TerrainType, World } from "@/domain/world/world";
import {
  executeMapCommand
} from "@/editor/commands/mapEditCommands";
import {
  applyGestureUpdate,
  createGestureSession,
  finishGestureSession,
  type GestureSession
} from "@/editor/tools/gestureSession";

export type EditGestureAction = "paint" | "erase";

export type EditGesture = GestureSession<EditGestureAction> & {
  type: TerrainType;
};

export function createEditGesture(
  action: EditGestureAction,
  world: World,
  level: number,
  type: TerrainType
): EditGesture {
  return {
    ...createGestureSession(action, world, level),
    type
  };
}

export function applyEditGestureCells(gesture: EditGesture, axials: Axial[]): World {
  for (const axial of axials) {
    const key = hexKey(axial);

    if (gesture.touchedKeys.has(key)) {
      continue;
    }

    gesture.touchedKeys.add(key);

    applyGestureUpdate(
      gesture,
      executeMapCommand(
        gesture.world,
        gesture.action === "paint"
          ? { type: "paintTerrain", level: gesture.level, axial, terrainType: gesture.type }
          : { type: "eraseTerrain", level: gesture.level, axial }
      )
    );
  }

  return gesture.world;
}

export function getFinishedGestureWorld(gesture: EditGesture): World | null {
  return finishGestureSession(gesture).previewWorld;
}
