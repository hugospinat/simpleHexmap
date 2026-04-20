export type {
  FactionPatch,
  FeaturePatch,
  MapFactionRecord,
  MapFactionTerritoryRecord,
  MapFeatureRecord,
  MapOperation,
  MapRiverRecord,
  MapRoadRecord,
  MapTileRecord,
  MapTokenOperation,
  MapTokenRecord,
  RiverEdgeIndex,
  RoadEdgeIndex,
  SavedMapContent,
} from "./types.js";
export type {
  MapOperationEnvelope,
  OperationApplier,
} from "./operationContracts.js";
export {
  applyMapOperation,
  applyMapOperations,
  applyOperationToSavedMapContentIndex,
  applyOperationToSavedMapContent,
  applyOperationsToSavedMapContent,
  indexSavedMapContent,
  materializeSavedMapContent,
  savedMapContentOperationApplier,
} from "./contentOperations.js";
export type { SavedMapContentIndex } from "./contentOperations.js";
export { coalesceMapOperations } from "./mapOperationCoalescer.js";
export {
  addRoadConnectionToRecords,
  getNeighborForRoadEdge,
  getOppositeRoadEdgeIndex,
  getRoadEdgeBetween,
  getTileOperationTerrain,
  isHexColor,
  isInteger,
  isObject,
  isRoadOrRiverEdge,
  normalizeRoad,
  removeFactionTerritory,
  removeRoadConnectionsAtFromRecords,
  riverKey,
  roadKey,
  sanitizeFactionPatch,
  sanitizeFeaturePatch,
  tileKey,
  type RiverKey,
  type TileKey,
} from "./recordHelpers.js";
export { validateMapOperation } from "./validation.js";
export {
  applyMapTokenOperation,
  applyMapTokenOperations,
  validateMapTokenOperation,
} from "./tokenOperations.js";
