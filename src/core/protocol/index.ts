export type {
  FactionPatch,
  FeaturePatch,
  MapDocument,
  MapFactionRecord,
  MapFactionTerritoryRecord,
  MapFeatureRecord,
  MapNoteRecord,
  MapOperation,
  MapRiverRecord,
  MapRoadRecord,
  MapTileRecord,
  MapTokenOperation,
  MapTokenPlacement,
  MapView,
  RiverEdgeIndex,
  RoadEdgeIndex,
} from "./types.js";
export type {
  MapOperationEnvelope,
  OperationApplier,
} from "./operationContracts.js";
export {
  applyMapDocumentOperation,
  applyMapDocumentOperations,
  applyOperationToMapDocumentIndex,
  applyOperationToMapDocument,
  applyOperationsToMapDocument,
  indexMapDocument,
  materializeMapDocument,
  mapDocumentOperationApplier,
} from "./contentOperations.js";
export type { MapDocumentIndex } from "./contentOperations.js";
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
