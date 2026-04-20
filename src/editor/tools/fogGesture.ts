import { hexKey, type Axial } from "@/core/geometry/hex";
import { getFeatureAt, getLevelMap, type MapState } from "@/core/map/world";
import { executeMapEditCommand } from "@/core/map/commands/mapEditCommands";
import {
  applyGestureUpdate,
  createGestureSession,
  finishGestureSession,
  type GestureCommit,
  type GestureSession,
} from "@/editor/tools/gestureSession";

export type FogGestureAction = "paint" | "erase";
export type FogGesture = GestureSession<FogGestureAction> & {
  targetHidden: boolean | null;
};

export function createFogGesture(
  action: FogGestureAction,
  world: MapState,
  level: number,
  initialAxial: Axial,
): FogGesture {
  const cell = getLevelMap(world, level).get(hexKey(initialAxial));
  const feature = getFeatureAt(world, level, initialAxial);

  return {
    ...createGestureSession(action, world, level),
    targetHidden:
      action === "paint"
        ? cell
          ? !cell.hidden
          : null
        : feature
          ? !feature.hidden
          : null,
  };
}

export function applyFogGestureCells(
  gesture: FogGesture,
  axials: Axial[],
): MapState {
  if (gesture.targetHidden === null) {
    return gesture.world;
  }

  for (const axial of axials) {
    const key = hexKey(axial);

    if (gesture.touchedKeys.has(key)) {
      continue;
    }

    gesture.touchedKeys.add(key);
    const cell = getLevelMap(gesture.world, gesture.level).get(key);
    const feature = getFeatureAt(gesture.world, gesture.level, axial);

    if (gesture.action === "paint") {
      if (cell && cell.hidden !== gesture.targetHidden) {
        applyGestureUpdate(
          gesture,
          executeMapEditCommand(gesture.world, {
            type: "setCellHidden",
            level: gesture.level,
            axial,
            hidden: gesture.targetHidden,
          }),
        );
      }
      continue;
    }

    if (feature && feature.hidden !== gesture.targetHidden) {
      applyGestureUpdate(
        gesture,
        executeMapEditCommand(gesture.world, {
          type: "setFeatureHidden",
          featureId: feature.id,
          hidden: gesture.targetHidden,
        }),
      );
    }
  }

  return gesture.world;
}

export function finishFogGesture(gesture: FogGesture): GestureCommit {
  return finishGestureSession(gesture);
}
