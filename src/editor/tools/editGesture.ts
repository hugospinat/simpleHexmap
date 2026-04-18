import { hexKey, type Axial } from "@/core/geometry/hex";
import type { TerrainType, MapState } from "@/core/map/world";
import {
  executeMapEditCommand
} from "@/core/map/commands/mapEditCommands";
import {
  applyGestureUpdate,
  createGestureSession,
  type GestureSession
} from "@/editor/tools/gestureSession";

export type EditGestureAction = "paint" | "erase";

export type EditGesture = GestureSession<EditGestureAction> & {
  type: TerrainType;
};

export function createEditGesture(
  action: EditGestureAction,
  world: MapState,
  level: number,
  type: TerrainType
): EditGesture {
  return {
    ...createGestureSession(action, world, level),
    type
  };
}

export function applyEditGestureCells(gesture: EditGesture, axials: Axial[]): MapState {
  for (const axial of axials) {
    const key = hexKey(axial);

    if (gesture.touchedKeys.has(key)) {
      continue;
    }

    gesture.touchedKeys.add(key);

    applyGestureUpdate(
      gesture,
      executeMapEditCommand(
        gesture.world,
        gesture.action === "paint"
          ? { type: "paintTerrain", level: gesture.level, axial, terrainType: gesture.type }
          : { type: "eraseTerrain", level: gesture.level, axial }
      )
    );
  }

  return gesture.world;
}

