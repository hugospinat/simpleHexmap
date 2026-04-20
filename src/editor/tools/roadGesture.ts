import { hexKey, type Axial } from "@/core/geometry/hex";
import type { MapState } from "@/core/map/world";
import { executeMapEditCommand } from "@/core/map/commands/mapEditCommands";
import {
  applyGestureUpdate,
  createGestureSession,
  type GestureSession,
} from "@/editor/tools/gestureSession";

export type RoadGestureAction = "add" | "remove";

export type RoadGesture = GestureSession<RoadGestureAction> & {
  lastAxial: Axial | null;
};

export function createRoadGesture(
  action: RoadGestureAction,
  world: MapState,
  level: number,
): RoadGesture {
  return {
    ...createGestureSession(action, world, level),
    lastAxial: null,
  };
}

export function applyRoadGestureCells(
  gesture: RoadGesture,
  axials: Axial[],
): MapState {
  for (const axial of axials) {
    if (!gesture.lastAxial) {
      gesture.lastAxial = axial;
      continue;
    }

    const key = hexKey(axial);

    if (hexKey(gesture.lastAxial) === key) {
      continue;
    }

    applyGestureUpdate(
      gesture,
      executeMapEditCommand(gesture.world, {
        type:
          gesture.action === "add"
            ? "addRoadConnection"
            : "removeRoadConnection",
        level: gesture.level,
        from: gesture.lastAxial,
        to: axial,
      }),
    );

    gesture.lastAxial = axial;
  }

  return gesture.world;
}
