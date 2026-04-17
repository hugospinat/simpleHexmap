export type {
  Axial,
  HexCell,
  LevelMap,
  RiverEdgeIndex,
  RiverEdgeRef,
  RiverEdgeSet,
  RiverFlow,
  RiverFlowLevelMap,
  RiverLevelMap,
  RoadLevelMap,
  TerrainType,
  World
} from "@/domain/world/worldTypes";
export type {
  RoadEdgeIndex,
  RoadEdgeSet
} from "@/domain/world/roads";
export type {
  Feature,
  FeatureKind,
  FeatureLevelMap,
  FeatureVisibilityMode
} from "@/domain/world/features";
export type {
  Faction,
  FactionLevelMap,
  FactionMap
} from "@/domain/world/factions";
export { SOURCE_LEVEL } from "@/domain/world/constants";
export {
  addFeature,
  axialToFeatureHexId,
  createFeature,
  featureHexIdToAxial,
  featureKindLabels,
  featureKinds,
  getFeatureAt,
  getFeatureById,
  getFeatureLabel,
  getFeaturesForLevel,
  isFeatureVisible,
  normalizeFeature,
  removeFeatureAt,
  updateFeature
} from "@/domain/world/features";
export {
  addFaction,
  assignFactionAt,
  clearFactionAt,
  getFactionById,
  getFactionLevelMap,
  getFactionOverlayColorMap,
  getFactions,
  removeFaction,
  updateFaction
} from "@/domain/world/factions";
export {
  addRoadConnection,
  getRoadLevelMap,
  getNeighborForRoadEdge,
  getOppositeRoadEdgeIndex,
  getRoadEdgesAt,
  getRoadLevelMap as getRoadNetworkForLevel,
  removeRoadConnection,
  removeRoadConnectionsAt,
  roadEdgeIndexes,
  roadHexIdToAxial
} from "@/domain/world/roads";
export { tileColors, tileTypes } from "@/domain/world/tileTypes";
export { TERRAIN_TYPES, terrainTypes } from "@/domain/world/terrainTypes";
export {
  addMissingNeighborsWithPropagation,
  addTile,
  addTileWithPropagation,
  createEmptyWorld,
  createInitialWorld,
  deleteWithDescendants,
  getLevelMap,
  propagateTileToDeeperLevels,
  setCellHidden,
  removeTile
} from "@/domain/world/worldState";
export {
  addRiverEdge,
  getCanonicalRiverEdgeKey,
  getCanonicalRiverEdgeRef,
  getNeighborForRiverEdge,
  getOppositeRiverEdgeIndex,
  getRiverEdgePathBetween,
  getRiverFlowLevelMap,
  getRiverLevelMap,
  getRiverEdgeRefKey,
  removeRiverEdge
} from "@/domain/world/rivers";
