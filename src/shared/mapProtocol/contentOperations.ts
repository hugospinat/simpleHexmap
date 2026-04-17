import type { MapOperation, MapRoadRecord, SavedMapContent } from "./types.js";
import {
  addRoadConnectionToRecords,
  getTileOperationTerrain,
  normalizeRoad,
  removeFactionTerritory,
  removeRoadConnectionsAtFromRecords,
  riverKey,
  roadKey,
  sanitizeFactionPatch,
  sanitizeFeaturePatch,
  tileKey
} from "./recordHelpers.js";

export function applyOperationToSavedMap<TSnapshot extends SavedMapContent>(snapshot: TSnapshot, operation: MapOperation): TSnapshot {
  switch (operation.type) {
    case "set_tile": {
      const key = tileKey(operation.tile);
      const filteredTiles = snapshot.tiles.filter((tile) => tileKey(tile) !== key);
      const terrain = getTileOperationTerrain(operation.tile);

      if (terrain === null) {
        return {
          ...snapshot,
          tiles: filteredTiles,
          factionTerritories: removeFactionTerritory(snapshot.factionTerritories, operation.tile.q, operation.tile.r)
        };
      }

      return {
        ...snapshot,
        tiles: [
          ...filteredTiles,
          {
            hidden: operation.tile.hidden ?? false,
            q: operation.tile.q,
            r: operation.tile.r,
            terrain
          }
        ]
      };
    }
    case "set_cell_hidden": {
      let changed = false;
      const tiles = snapshot.tiles.map((tile) => {
        if (tile.q !== operation.cell.q || tile.r !== operation.cell.r || tile.hidden === operation.cell.hidden) {
          return tile;
        }

        changed = true;
        return {
          ...tile,
          hidden: operation.cell.hidden
        };
      });

      return changed ? { ...snapshot, tiles } : snapshot;
    }
    case "add_feature": {
      if (snapshot.features.some((feature) => feature.id === operation.feature.id)) {
        return snapshot;
      }

      const { type, ...feature } = operation.feature;
      return {
        ...snapshot,
        features: [
          ...snapshot.features,
          {
            ...feature,
            kind: feature.kind ?? type
          }
        ]
      };
    }
    case "set_feature_hidden": {
      const visibility: "hidden" | "visible" = operation.hidden ? "hidden" : "visible";
      let changed = false;
      const features = snapshot.features.map((feature) => {
        if (feature.id !== operation.featureId || feature.visibility === visibility) {
          return feature;
        }

        changed = true;
        return {
          ...feature,
          visibility
        };
      });

      return changed ? { ...snapshot, features } : snapshot;
    }
    case "update_feature": {
      const patch = sanitizeFeaturePatch(operation.patch);
      let changed = false;
      const features = snapshot.features.map((feature) => {
        if (feature.id !== operation.featureId) {
          return feature;
        }

        changed = true;
        return {
          ...feature,
          ...patch
        };
      });

      return changed ? { ...snapshot, features } : snapshot;
    }
    case "remove_feature":
      return {
        ...snapshot,
        features: snapshot.features.filter((feature) => feature.id !== operation.featureId)
      };
    case "add_river_data": {
      const key = riverKey(operation.river);

      if (snapshot.rivers.some((river) => riverKey(river) === key)) {
        return snapshot;
      }

      return {
        ...snapshot,
        rivers: [...snapshot.rivers, operation.river]
      };
    }
    case "remove_river_data":
      return {
        ...snapshot,
        rivers: snapshot.rivers.filter((river) => riverKey(river) !== riverKey(operation.river))
      };
    case "add_road_data":
    case "update_road_data": {
      const normalized = normalizeRoad(operation.road);
      const roads = snapshot.roads.filter((road) => roadKey(road) !== roadKey(normalized));
      roads.push(normalized);

      return {
        ...snapshot,
        roads
      };
    }
    case "remove_road_data":
      return {
        ...snapshot,
        roads: snapshot.roads.filter((road) => roadKey(road) !== roadKey(operation.road))
      };
    case "add_road_connection":
      return {
        ...snapshot,
        roads: addRoadConnectionToRecords(snapshot.roads, operation.from, operation.to)
      };
    case "remove_road_connections_at":
      return {
        ...snapshot,
        roads: removeRoadConnectionsAtFromRecords(snapshot.roads, operation.cell)
      };
    case "add_faction": {
      if (snapshot.factions.some((faction) => faction.id === operation.faction.id)) {
        return snapshot;
      }

      return {
        ...snapshot,
        factions: [...snapshot.factions, operation.faction]
      };
    }
    case "update_faction": {
      const patch = sanitizeFactionPatch(operation.patch);
      let changed = false;
      const factions = snapshot.factions.map((faction) => {
        if (faction.id !== operation.factionId) {
          return faction;
        }

        changed = true;
        return {
          ...faction,
          ...patch
        };
      });

      return changed ? { ...snapshot, factions } : snapshot;
    }
    case "remove_faction":
      return {
        ...snapshot,
        factions: snapshot.factions.filter((faction) => faction.id !== operation.factionId),
        factionTerritories: snapshot.factionTerritories.filter((territory) => territory.factionId !== operation.factionId)
      };
    case "set_faction_territory": {
      const { q, r, factionId } = operation.territory;
      const factionTerritories = removeFactionTerritory(snapshot.factionTerritories, q, r);

      if (factionId) {
        factionTerritories.push({ q, r, factionId });
      }

      return {
        ...snapshot,
        factionTerritories
      };
    }
    case "rename_map":
      return snapshot;
    default: {
      const exhaustive: never = operation;
      void exhaustive;
      return snapshot;
    }
  }
}

export function applyOperationsToSavedMap<TSnapshot extends SavedMapContent>(snapshot: TSnapshot, operations: MapOperation[]): TSnapshot {
  return operations.reduce(applyOperationToSavedMap, snapshot);
}

export function applyRoadOperationToRecords(
  roads: MapRoadRecord[],
  operation: Extract<MapOperation, { type: "add_road_data" | "update_road_data" | "remove_road_data" }>
): MapRoadRecord[] {
  if (operation.type === "remove_road_data") {
    return roads.filter((road) => roadKey(road) !== roadKey(operation.road));
  }

  const normalized = normalizeRoad(operation.road);
  const next = roads.filter((road) => roadKey(road) !== roadKey(normalized));
  next.push(normalized);
  return next;
}

export const applyMapOperation = applyOperationToSavedMap;
export const applyMapOperations = applyOperationsToSavedMap;
