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

export type SavedMapContent = {
  version: number;
  tiles: MapTileRecord[];
  features: MapFeatureRecord[];
  rivers: MapRiverRecord[];
  roads: MapRoadRecord[];
  factions: MapFactionRecord[];
  factionTerritories: MapFactionTerritoryRecord[];
};

export type FeaturePatch = Partial<Pick<
  MapFeatureRecord,
  "gmLabel" | "kind" | "labelRevealed" | "overrideTerrainTile" | "playerLabel" | "visibility"
>>;

export type FactionPatch = Partial<Pick<MapFactionRecord, "color" | "name">>;

export type MapOperation =
  | { type: "set_tile"; tile: Omit<MapTileRecord, "terrain"> & { terrain: string | null } }
  | { type: "set_cell_hidden"; cell: { q: number; r: number; hidden: boolean } }
  | { type: "add_feature"; feature: MapFeatureRecord }
  | { type: "set_feature_hidden"; featureId: string; hidden: boolean }
  | { type: "update_feature"; featureId: string; patch: FeaturePatch }
  | { type: "remove_feature"; featureId: string }
  | { type: "add_river_data"; river: MapRiverRecord }
  | { type: "remove_river_data"; river: MapRiverRecord }
  | { type: "add_road_data"; road: MapRoadRecord }
  | { type: "update_road_data"; road: MapRoadRecord }
  | { type: "remove_road_data"; road: Pick<MapRoadRecord, "q" | "r"> }
  | { type: "add_road_connection"; from: { q: number; r: number }; to: { q: number; r: number } }
  | { type: "remove_road_connections_at"; cell: { q: number; r: number } }
  | { type: "add_faction"; faction: MapFactionRecord }
  | { type: "update_faction"; factionId: string; patch: FactionPatch }
  | { type: "remove_faction"; factionId: string }
  | { type: "set_faction_territory"; territory: { q: number; r: number; factionId: string | null } }
  | { type: "rename_map"; name: string };
