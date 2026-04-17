import type { Axial, HexId } from "@/core/geometry/hex";
import type { FeatureLevelMap } from "@/core/map/features";
import type { FactionLevelMap, FactionMap } from "@/core/map/factions";
import type { RoadLevelMap } from "@/core/map/roads";
import type { TerrainType } from "@/core/map/terrainTypes";

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
};
