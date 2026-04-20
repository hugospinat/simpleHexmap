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
  visibility: "visible" | "hidden";
  overrideTerrainTile: boolean;
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

export type MapTokenRecord = {
  profileId: string;
  q: number;
  r: number;
  color: string;
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

export type SavedMapContent = {
  version: number;
  tiles: MapTileRecord[];
  features: MapFeatureRecord[];
  rivers: MapRiverRecord[];
  roads: MapRoadRecord[];
  factions: MapFactionRecord[];
  factionTerritories: MapFactionTerritoryRecord[];
  tokens: MapTokenRecord[];
};

export type MapTokenOperation =
  | { type: "set_map_token"; token: MapTokenRecord }
  | { type: "remove_map_token"; profileId: string }
  | { type: "set_map_token_color"; profileId: string; color: string };

export type FeaturePatch = Partial<
  Pick<
    MapFeatureRecord,
    | "gmLabel"
    | "kind"
    | "labelRevealed"
    | "overrideTerrainTile"
    | "playerLabel"
    | "visibility"
  >
>;

export type FactionPatch = Partial<Pick<MapFactionRecord, "color" | "name">>;

export type MapOperation =
  | {
      type: "paint_cells";
      cells: MapCellRef[];
      terrain: string | null;
      hidden: boolean;
    }
  | { type: "set_cells_hidden"; cells: MapCellRef[]; hidden: boolean }
  | {
      type: "assign_faction_cells";
      cells: MapCellRef[];
      factionId: string | null;
    }
  | { type: "set_tiles"; tiles: MapTileUpdate[] }
  | {
      type: "set_faction_territories";
      territories: MapFactionTerritoryUpdate[];
    }
  | { type: "add_feature"; feature: MapFeatureRecord }
  | { type: "set_feature_hidden"; featureId: string; hidden: boolean }
  | { type: "update_feature"; featureId: string; patch: FeaturePatch }
  | { type: "remove_feature"; featureId: string }
  | { type: "add_river_data"; river: MapRiverRecord }
  | { type: "remove_river_data"; river: MapRiverRecord }
  | { type: "set_road_edges"; cell: MapCellRef; edges: RoadEdgeIndex[] }
  | { type: "add_faction"; faction: MapFactionRecord }
  | { type: "update_faction"; factionId: string; patch: FactionPatch }
  | { type: "remove_faction"; factionId: string }
  | { type: "rename_map"; name: string };
