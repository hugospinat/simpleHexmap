import type { GestureSession } from "@/editor/tools/gestureSession";
import type { MapOperation } from "@/core/protocol";
import type { MapState } from "@/core/map/world";

export type ToolStrategy<TContext, TInput, TAction extends string> = {
  begin: (context: TContext, input: TInput) => GestureSession<TAction> | null;
  canHandle: (input: TInput) => boolean;
};

export type ToolInput = {
  world: MapState;
};

export type ToolResult = {
  changed: boolean;
  operations: MapOperation[];
  previewWorld: MapState | null;
};

export type ToolCommit = ToolResult;

export type ToolController<TInput extends ToolInput = ToolInput> = {
  begin: (input: TInput) => ToolResult;
  cancel: () => void;
  commit: () => ToolCommit;
  update: (input: TInput) => ToolResult;
};
