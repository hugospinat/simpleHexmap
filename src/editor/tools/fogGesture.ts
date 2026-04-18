import { hexKey, type Axial } from "@/core/geometry/hex";
import { getFeatureAt, getLevelMap, type MapState } from "@/core/map/world";
import { executeMapEditCommand } from "@/core/map/commands/mapEditCommands";
import {
  applyGestureUpdate,
  createGestureSession,
  finishGestureSession,
  type GestureCommit,
  type GestureSession
} from "@/editor/tools/gestureSession";

export type FogGestureAction = "paint" | "erase";
export type FogGesture = GestureSession<FogGestureAction>;

export function createFogGesture(action: FogGestureAction, world: MapState, level: number): FogGesture {
  return createGestureSession(action, world, level);
}

export function applyFogGestureCells(gesture: FogGesture, axials: Axial[]): MapState {
  for (const axial of axials) {
    const key = hexKey(axial);

    if (gesture.touchedKeys.has(key)) {
      continue;
    }

    gesture.touchedKeys.add(key);
    const cell = getLevelMap(gesture.world, gesture.level).get(key);
    const feature = getFeatureAt(gesture.world, gesture.level, axial);

    if (gesture.action === "paint") {
      if (feature && !feature.hidden) {
        applyGestureUpdate(
          gesture,
          executeMapEditCommand(gesture.world, {
            type: "setFeatureHidden",
            featureId: feature.id,
            hidden: true
          })
        );
        continue;
      }

      if (cell && !cell.hidden) {
        applyGestureUpdate(
          gesture,
          executeMapEditCommand(gesture.world, {
            type: "setCellHidden",
            level: gesture.level,
            axial,
            hidden: true
          })
        );
      }
      continue;
    }

    if (cell?.hidden) {
      applyGestureUpdate(
        gesture,
        executeMapEditCommand(gesture.world, {
          type: "setCellHidden",
          level: gesture.level,
          axial,
          hidden: false
        })
      );
      continue;
    }

    if (feature?.hidden) {
      applyGestureUpdate(
        gesture,
        executeMapEditCommand(gesture.world, {
          type: "setFeatureHidden",
          featureId: feature.id,
          hidden: false
        })
      );
    }
  }

  return gesture.world;
}

export function finishFogGesture(gesture: FogGesture): GestureCommit {
  return finishGestureSession(gesture);
}
