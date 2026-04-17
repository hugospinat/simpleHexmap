import type { Axial, Pixel } from "@/core/geometry/hex";
import type { RiverEdgeRef } from "@/core/map/world";
import type { EditGestureAction } from "@/editor/tools/editGesture";
import type { EditorMode } from "@/editor/tools/editorTypes";

export type PointerAction = EditGestureAction | "pan";
export type PointerTarget = "cells" | "river";

export type PointerSession = Pixel & {
  action: PointerAction;
  target: PointerTarget;
  lastAxial: Axial | null;
  lastRiverEdge: RiverEdgeRef | null;
  moved: boolean;
};

export function getPointerAction(button: number): PointerAction | null {
  if (button === 0) {
    return "paint";
  }

  if (button === 1) {
    return "pan";
  }

  if (button === 2) {
    return "erase";
  }

  return null;
}

export function getPointerTarget(editMode: EditorMode, action: PointerAction): PointerTarget {
  return editMode === "river" && action !== "pan" ? "river" : "cells";
}
