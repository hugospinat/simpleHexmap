export type RoadEdgeIndex = 0 | 1 | 2 | 3 | 4 | 5;
export type RiverEdgeIndex = RoadEdgeIndex;

export type MapTileRecord = {
  q: number;
  r: number;
  terrain: string;
  hidden: boolean;
};

export type MapFeatureRecord = {
  id: string;
  kind: string;
  q: number;
  r: number;
  hidden: boolean;
  gmLabel: string | null;
  playerLabel: string | null;
  labelRevealed: boolean;
};

export type MapRiverRecord = {
  q: number;
  r: number;
  edge: RiverEdgeIndex;
};

export type MapRoadRecord = {
  q: number;
  r: number;
  edges: RoadEdgeIndex[];
};

export type MapFactionRecord = {
  id: string;
  name: string;
  color: string;
};

export type MapFactionTerritoryRecord = {
  q: number;
  r: number;
  factionId: string;
};

export type MapTokenPlacement = {
  userId: string;
  q: number;
  r: number;
};

export type MapCellRef = {
  q: number;
  r: number;
};

export type MapTileUpdate = MapCellRef & {
  terrain: string | null;
  hidden: boolean;
};

export type MapFactionTerritoryUpdate = MapCellRef & {
  factionId: string | null;
};

export type MapDocument = {
  version: number;
  tiles: MapTileRecord[];
  features: MapFeatureRecord[];
  rivers: MapRiverRecord[];
  roads: MapRoadRecord[];
  factions: MapFactionRecord[];
  factionTerritories: MapFactionTerritoryRecord[];
};

export type MapView = {
  document: MapDocument;
  tokenPlacements: MapTokenPlacement[];
};

export type MapTokenOperation =
  | { type: "set_map_token"; placement: MapTokenPlacement }
  | { type: "remove_map_token"; userId: string }
  | { type: "set_map_token_color"; userId: string; color: string };

export type FeaturePatch = Partial<
  Pick<
    MapFeatureRecord,
    "gmLabel" | "hidden" | "kind" | "labelRevealed" | "playerLabel"
  >
>;

export type FactionPatch = Partial<Pick<MapFactionRecord, "color" | "name">>;

export type MapOperation =
  | { type: "set_tiles"; tiles: MapTileUpdate[] }
  | {
      type: "set_faction_territories";
      territories: MapFactionTerritoryUpdate[];
    }
  | { type: "add_feature"; feature: MapFeatureRecord }
  | { type: "update_feature"; featureId: string; patch: FeaturePatch }
  | { type: "remove_feature"; featureId: string }
  | { type: "add_river_data"; river: MapRiverRecord }
  | { type: "remove_river_data"; river: MapRiverRecord }
  | { type: "set_road_edges"; cell: MapCellRef; edges: RoadEdgeIndex[] }
  | { type: "add_faction"; faction: MapFactionRecord }
  | { type: "update_faction"; factionId: string; patch: FactionPatch }
  | { type: "remove_faction"; factionId: string };
