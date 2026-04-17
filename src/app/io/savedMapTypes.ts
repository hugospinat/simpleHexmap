import type { RiverEdgeIndex, RoadEdgeIndex } from "@/domain/world/world";

export const mapFileVersion = 1;

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

export type SavedMap = {
  version: number;
  tiles: MapTileRecord[];
  features: MapFeatureRecord[];
  rivers: MapRiverRecord[];
  roads: MapRoadRecord[];
  factions: MapFactionRecord[];
  factionTerritories: MapFactionTerritoryRecord[];
};
