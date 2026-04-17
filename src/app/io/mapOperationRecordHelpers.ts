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
} from "@/shared/mapProtocol";
export type {
  MapFactionRecord,
  MapFeatureRecord,
  MapRiverRecord,
  MapRoadRecord,
  MapTileRecord
} from "@/app/io/mapFormat";
