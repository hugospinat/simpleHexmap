import type { MapOperation } from "@/core/protocol/types";

export type RenderWorldPatch =
  | { type: "snapshot"; revision: number }
  | { type: "operations"; revision: number; operations: MapOperation[] };
