import type { Axial } from "@/domain/geometry/hex";
import type { FeatureLevelMap } from "@/domain/world/features";
import type { FactionLevelMap, FactionMap } from "@/domain/world/factions";
import type { RoadLevelMap } from "@/domain/world/roads";
import type { TerrainType } from "@/domain/world/terrainTypes";

export type { Axial, RoadLevelMap };

export type { TerrainType };

export type HexCell = {
  type: TerrainType;
  hidden: boolean;
};

export type LevelMap = Map<string, HexCell>;

export type RiverEdgeIndex = 0 | 1 | 2 | 3 | 4 | 5;
export type RiverEdgeSet = Set<RiverEdgeIndex>;
export type RiverLevelMap = Map<string, RiverEdgeSet>;

export type RiverFlow = {
  entryEdge: RiverEdgeIndex;
  exitEdge: RiverEdgeIndex;
};

export type RiverFlowLevelMap = Map<string, RiverFlow[]>;

export type RiverEdgeRef = {
  axial: Axial;
  edge: RiverEdgeIndex;
};

export type World = {
  levels: Record<number, LevelMap>;
  featuresByLevel: Record<number, FeatureLevelMap>;
  factions: FactionMap;
  factionAssignmentsByLevel: Record<number, FactionLevelMap>;
  riversByLevel: Record<number, RiverLevelMap>;
  roadsByLevel: Record<number, RoadLevelMap>;
};
