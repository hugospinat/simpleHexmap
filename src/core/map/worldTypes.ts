import type { Axial, HexId } from "../geometry/hex.js";
import type { FeatureLevelMap } from "./features.js";
import type { FactionLevelMap, FactionMap } from "./factions.js";
import type { RoadLevelMap } from "./roads.js";
import type { TerrainType } from "./terrainTypes.js";

export type { Axial, RoadLevelMap };
export type { HexId };

export type { TerrainType };

export type HexCell = {
  type: TerrainType;
  hidden: boolean;
};

export type LevelMap = Map<string, HexCell>;

export type RiverEdgeIndex = 0 | 1 | 2 | 3 | 4 | 5;
export type RiverEdgeSet = Set<RiverEdgeIndex>;
export type RiverLevelMap = Map<string, RiverEdgeSet>;

export type RiverEdgeRef = {
  axial: Axial;
  edge: RiverEdgeIndex;
};

export type MapState = {
  levels: Record<number, LevelMap>;
  featuresByLevel: Record<number, FeatureLevelMap>;
  factions: FactionMap;
  factionAssignmentsByLevel: Record<number, FactionLevelMap>;
  riversByLevel: Record<number, RiverLevelMap>;
  roadsByLevel: Record<number, RoadLevelMap>;
  versions: MapStateVersions;
};

export type MapStateVersionKey =
  | "terrain"
  | "features"
  | "factions"
  | "roads"
  | "rivers";

export type MapStateVersions = Record<MapStateVersionKey, number>;

export function createInitialMapStateVersions(): MapStateVersions {
  return {
    terrain: 0,
    features: 0,
    factions: 0,
    roads: 0,
    rivers: 0,
  };
}

export function bumpMapStateVersion(
  world: MapState,
  key: MapStateVersionKey,
): MapStateVersions {
  return {
    ...(world.versions ?? createInitialMapStateVersions()),
    [key]: (world.versions?.[key] ?? 0) + 1,
  };
}
