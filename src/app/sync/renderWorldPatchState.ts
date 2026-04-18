import type { MapOperation } from "@/core/protocol";
import type { RenderWorldPatch } from "@/render/renderWorldPatch";

export type RenderWorldPatchInput =
  | { type: "snapshot" }
  | { type: "operations"; operations: MapOperation[] };

export function mergeRenderWorldPatch(
  previous: RenderWorldPatch,
  acknowledgedRevision: number,
  next: RenderWorldPatchInput,
  revision: number
): RenderWorldPatch {
  if (next.type === "snapshot") {
    return { revision, type: "snapshot" };
  }

  const previousOperations = previous.type === "operations" && previous.revision > acknowledgedRevision
    ? previous.operations
    : [];

  return {
    operations: [...previousOperations, ...next.operations],
    revision,
    type: "operations"
  };
}
