import type { MapOperation } from "@/shared/mapProtocol";
import type { World } from "@/domain/world/world";

export type GestureSession<TAction extends string> = {
  action: TAction;
  changed: boolean;
  level: number;
  operations: MapOperation[];
  touchedKeys: Set<string>;
  world: World;
};

export type GestureUpdate = {
  operations: MapOperation[];
  world: World;
};

export type GestureCommit = {
  changed: boolean;
  operations: MapOperation[];
  previewWorld: World | null;
};

export function createGestureSession<TAction extends string>(
  action: TAction,
  world: World,
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
  if (update.world === session.world) {
    return false;
  }

  session.world = update.world;
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
