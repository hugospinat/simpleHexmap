export type { FactionPatch, FeaturePatch, MapOperation } from "@/shared/mapProtocol";
export {
  applyMapOperation,
  applyMapOperations,
  applyOperationToSavedMap,
  applyOperationsToSavedMap
} from "@/app/io/savedMapOperations";
export {
  applyMapOperationToWorld,
  applyOperationToWorld,
  applyOperationsToWorld
} from "@/app/io/worldMapOperations";
