export type {
  Axial,
  HexId,
  HexCell,
  LevelMap,
  RiverEdgeIndex,
  RiverEdgeRef,
  RiverEdgeSet,
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
export {
  addFeature,
  axialToFeatureHexId,
  canFeatureKindOverrideTerrain,
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
  MAP_LEVELS,
  MAX_LEVEL,
  MIN_LEVEL,
  SOURCE_LEVEL,
  isSourceLevel,
  type MapLevel
} from "@/domain/world/mapRules";
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
  getRoadEdgeBetween,
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
  getRiverLevelMap,
  getRiverEdgeRefKey,
  removeRiverEdge
} from "@/domain/world/rivers";
