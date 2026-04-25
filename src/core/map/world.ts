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
  MapState,
} from "@/core/map/worldTypes";
export type { RoadEdgeIndex, RoadEdgeSet } from "@/core/map/roads";
export type {
  Feature,
  FeatureKind,
  FeatureLevel,
  FeatureLevelMap,
  FeatureVisibilityMode,
} from "@/core/map/features";
export type { Faction, FactionLevelMap, FactionMap } from "@/core/map/factions";
export {
  addFeature,
  axialToFeatureHexId,
  canFeatureKindOverrideTerrain,
  createFeature,
  featureDefinitions,
  featureHexIdToAxial,
  featureKindLabels,
  featureKinds,
  getFeatureDefinition,
  getFeatureAt,
  getFeatureById,
  getFeatureLevelForKind,
  getFeaturesForLevel,
  isFeatureKind,
  isFeatureLevel,
  isFeatureVisible,
  normalizeFeature,
  removeFeatureAt,
  updateFeature,
} from "@/core/map/features";
export {
  MAP_LEVELS,
  MAX_LEVEL,
  MIN_LEVEL,
  SOURCE_LEVEL,
  isSourceLevel,
  type MapLevel,
} from "@/core/map/mapRules";
export {
  addFaction,
  assignFactionAt,
  clearFactionAt,
  getFactionById,
  getFactionLevelMap,
  getFactionOverlayColorMap,
  getFactions,
  removeFaction,
  updateFaction,
} from "@/core/map/factions";
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
  roadHexIdToAxial,
  setRoadEdgesAt,
} from "@/core/map/roads";
export { tileColors, tileTypes } from "@/core/map/tileTypes";
export { TERRAIN_TYPES, terrainTypes } from "@/core/map/terrainTypes";
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
  removeTile,
} from "@/core/map/worldState";
export {
  addRiverEdge,
  getCanonicalRiverEdgeKey,
  getCanonicalRiverEdgeRef,
  getNeighborForRiverEdge,
  getOppositeRiverEdgeIndex,
  getRiverLevelMap,
  getRiverEdgeRefKey,
  removeRiverEdge,
} from "@/core/map/rivers";
