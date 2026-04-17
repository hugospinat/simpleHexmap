import type { Axial } from "@/core/geometry/hex";
import type { Faction, Feature, RiverEdgeRef, TerrainType, MapState } from "@/core/map/world";
import type { MapOperation } from "@/core/protocol";

export type MapEditCommandResult = {
  changed: boolean;
  effects?: MapEditCommandEffects;
  mapState: MapState;
  operations: MapOperation[];
};

export type MapEditCommandEffects = {
  selectedFeatureId?: string | null;
};

export type MapEditCommand =
  | { type: "paintTerrain"; level: number; axial: Axial; terrainType: TerrainType }
  | { type: "eraseTerrain"; level: number; axial: Axial }
  | { type: "setCellHidden"; level: number; axial: Axial; hidden: boolean }
  | { type: "addFeature"; level: number; feature: Feature }
  | {
    type: "updateFeature";
    level: number;
    featureId: string;
    updates: Partial<Pick<Feature, "gmLabel" | "hidden" | "kind" | "labelRevealed" | "overrideTerrainTile" | "playerLabel">>;
  }
  | { type: "setFeatureHidden"; featureId: string; hidden: boolean }
  | { type: "removeFeature"; featureId: string }
  | { type: "assignFaction"; level: number; axial: Axial; factionId: string }
  | { type: "clearFaction"; level: number; axial: Axial }
  | { type: "addFaction"; faction: Faction }
  | { type: "updateFaction"; factionId: string; patch: Partial<Pick<Faction, "color" | "name">> }
  | { type: "removeFaction"; factionId: string }
  | { type: "addRoadConnection"; level: number; from: Axial; to: Axial }
  | { type: "removeRoadConnectionsAt"; level: number; axial: Axial }
  | { type: "setRiverEdge"; level: number; ref: RiverEdgeRef; enabled: boolean }
  | { type: "toggleFeatureHiddenAt"; level: number; axial: Axial };

export function emptyCommandResult(mapState: MapState): MapEditCommandResult {
  return {
    changed: false,
    mapState,
    operations: []
  };
}
