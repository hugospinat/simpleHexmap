import type { GestureSession } from "@/editor/tools/gestureSession";

export type ToolStrategy<TContext, TInput, TAction extends string> = {
  begin: (context: TContext, input: TInput) => GestureSession<TAction> | null;
  canHandle: (input: TInput) => boolean;
};
