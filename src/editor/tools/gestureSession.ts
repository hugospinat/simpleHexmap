import type { MapOperation } from "@/core/protocol";
import type { MapState } from "@/core/map/world";

export type GestureSession<TAction extends string> = {
  action: TAction;
  changed: boolean;
  level: number;
  operations: MapOperation[];
  touchedKeys: Set<string>;
  world: MapState;
};

export type GestureUpdate = {
  mapState: MapState;
  operations: MapOperation[];
};

export type GestureCommit = {
  changed: boolean;
  operations: MapOperation[];
  previewWorld: MapState | null;
};

export function createGestureSession<TAction extends string>(
  action: TAction,
  world: MapState,
  level: number
): GestureSession<TAction> {
  return {
    action,
    changed: false,
    level,
    operations: [],
    touchedKeys: new Set(),
    world
  };
}

export function applyGestureUpdate<TAction extends string>(
  session: GestureSession<TAction>,
  update: GestureUpdate
): boolean {
  if (update.mapState === session.world) {
    return false;
  }

  session.world = update.mapState;
  session.operations.push(...update.operations);
  session.changed = true;
  return true;
}

export function finishGestureSession<TAction extends string>(session: GestureSession<TAction>): GestureCommit {
  return {
    changed: session.changed,
    operations: session.operations,
    previewWorld: session.changed ? session.world : null
  };
}
