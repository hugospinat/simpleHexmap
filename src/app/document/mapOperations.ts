export type { FactionPatch, FeaturePatch, MapOperation } from "@/core/protocol";
export {
  applyMapOperation,
  applyMapOperations,
  applyOperationToSavedMapContent,
  applyOperationsToSavedMapContent
} from "@/app/document/savedMapOperations";
export {
  applyMapOperationToWorld,
  applyOperationToWorld,
  applyOperationsToWorld
} from "@/app/document/worldMapOperations";
