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
  RiverEdgeIndex,
  RoadEdgeIndex,
  SavedMapContent
} from "./types.js";
export type {
  MapOperationEnvelope,
  OperationApplier
} from "./operationContracts.js";
export {
  applyMapOperation,
  applyMapOperations,
  applyOperationToSavedMapContent,
  applyOperationsToSavedMapContent,
  applyRoadOperationToRecords,
  savedMapContentOperationApplier
} from "./contentOperations.js";
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
  type TileKey
} from "./recordHelpers.js";
export { validateMapOperation } from "./validation.js";
