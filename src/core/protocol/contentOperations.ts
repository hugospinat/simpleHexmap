import type { OperationApplier } from "./operationContracts.js";
import type {
  MapFactionRecord,
  MapFactionTerritoryRecord,
  MapFeatureRecord,
  MapOperation,
  MapRiverRecord,
  MapRoadRecord,
  MapTileRecord,
  SavedMapContent
} from "./types.js";
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

export function applyOperationToSavedMapContent<TSnapshot extends SavedMapContent>(snapshot: TSnapshot, operation: MapOperation): TSnapshot {
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

      return {
        ...snapshot,
        features: [
          ...snapshot.features,
          operation.feature
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

export function applyOperationsToSavedMapContent<TSnapshot extends SavedMapContent>(snapshot: TSnapshot, operations: readonly MapOperation[]): TSnapshot {
  if (operations.length === 0) {
    return snapshot;
  }

  return applyOperationsToSavedMapContentIndexed(snapshot, operations);
}

export const savedMapContentOperationApplier: OperationApplier<SavedMapContent> = {
  apply: applyOperationToSavedMapContent,
  applyMany: applyOperationsToSavedMapContent
};

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

export const applyMapOperation = applyOperationToSavedMapContent;
export const applyMapOperations = applyOperationsToSavedMapContent;

export type SavedMapContentIndex = {
  factionTerritoriesByHex: Map<string, MapFactionTerritoryRecord>;
  factionsById: Map<string, MapFactionRecord>;
  featuresById: Map<string, MapFeatureRecord>;
  riversByKey: Map<string, MapRiverRecord>;
  roads: MapRoadRecord[];
  tilesByHex: Map<string, MapTileRecord>;
};

export function indexSavedMapContent(snapshot: SavedMapContent): SavedMapContentIndex {
  return {
    factionTerritoriesByHex: new Map(snapshot.factionTerritories.map((territory) => [tileKey(territory), territory])),
    factionsById: new Map(snapshot.factions.map((faction) => [faction.id, faction])),
    featuresById: new Map(snapshot.features.map((feature) => [feature.id, feature])),
    riversByKey: new Map(snapshot.rivers.map((river) => [riverKey(river), river])),
    roads: snapshot.roads,
    tilesByHex: new Map(snapshot.tiles.map((tile) => [tileKey(tile), tile]))
  };
}

export function materializeSavedMapContent<TSnapshot extends SavedMapContent>(
  snapshot: TSnapshot,
  index: SavedMapContentIndex
): TSnapshot {
  return {
    ...snapshot,
    tiles: Array.from(index.tilesByHex.values()),
    features: Array.from(index.featuresById.values()),
    rivers: Array.from(index.riversByKey.values()),
    roads: index.roads,
    factions: Array.from(index.factionsById.values()),
    factionTerritories: Array.from(index.factionTerritoriesByHex.values())
  };
}

export function applyOperationToSavedMapContentIndex(index: SavedMapContentIndex, operation: MapOperation): void {
  switch (operation.type) {
    case "set_tile": {
      const key = tileKey(operation.tile);
      const terrain = getTileOperationTerrain(operation.tile);
      index.tilesByHex.delete(key);

      if (terrain === null) {
        index.factionTerritoriesByHex.delete(key);
        return;
      }

      index.tilesByHex.set(key, {
        hidden: operation.tile.hidden ?? false,
        q: operation.tile.q,
        r: operation.tile.r,
        terrain
      });
      return;
    }
    case "set_cell_hidden": {
      const key = tileKey(operation.cell);
      const tile = index.tilesByHex.get(key);

      if (!tile || tile.hidden === operation.cell.hidden) {
        return;
      }

      index.tilesByHex.set(key, {
        ...tile,
        hidden: operation.cell.hidden
      });
      return;
    }
    case "add_feature": {
      if (index.featuresById.has(operation.feature.id)) {
        return;
      }

      index.featuresById.set(operation.feature.id, operation.feature);
      return;
    }
    case "set_feature_hidden": {
      const feature = index.featuresById.get(operation.featureId);
      const visibility: "hidden" | "visible" = operation.hidden ? "hidden" : "visible";

      if (!feature || feature.visibility === visibility) {
        return;
      }

      index.featuresById.set(operation.featureId, {
        ...feature,
        visibility
      });
      return;
    }
    case "update_feature": {
      const feature = index.featuresById.get(operation.featureId);

      if (!feature) {
        return;
      }

      index.featuresById.set(operation.featureId, {
        ...feature,
        ...sanitizeFeaturePatch(operation.patch)
      });
      return;
    }
    case "remove_feature":
      index.featuresById.delete(operation.featureId);
      return;
    case "add_river_data": {
      const key = riverKey(operation.river);

      if (!index.riversByKey.has(key)) {
        index.riversByKey.set(key, operation.river);
      }
      return;
    }
    case "remove_river_data":
      index.riversByKey.delete(riverKey(operation.river));
      return;
    case "add_road_data":
    case "update_road_data":
    case "remove_road_data":
      index.roads = applyRoadOperationToRecords(index.roads, operation);
      return;
    case "add_road_connection":
      index.roads = addRoadConnectionToRecords(index.roads, operation.from, operation.to);
      return;
    case "remove_road_connections_at":
      index.roads = removeRoadConnectionsAtFromRecords(index.roads, operation.cell);
      return;
    case "add_faction": {
      if (!index.factionsById.has(operation.faction.id)) {
        index.factionsById.set(operation.faction.id, operation.faction);
      }
      return;
    }
    case "update_faction": {
      const faction = index.factionsById.get(operation.factionId);

      if (!faction) {
        return;
      }

      index.factionsById.set(operation.factionId, {
        ...faction,
        ...sanitizeFactionPatch(operation.patch)
      });
      return;
    }
    case "remove_faction":
      index.factionsById.delete(operation.factionId);
      for (const [key, territory] of index.factionTerritoriesByHex.entries()) {
        if (territory.factionId === operation.factionId) {
          index.factionTerritoriesByHex.delete(key);
        }
      }
      return;
    case "set_faction_territory": {
      const key = tileKey(operation.territory);
      index.factionTerritoriesByHex.delete(key);

      if (operation.territory.factionId) {
        index.factionTerritoriesByHex.set(key, {
          q: operation.territory.q,
          r: operation.territory.r,
          factionId: operation.territory.factionId
        });
      }
      return;
    }
    case "rename_map":
      return;
    default: {
      const exhaustive: never = operation;
      void exhaustive;
    }
  }
}

function applyOperationsToSavedMapContentIndexed<TSnapshot extends SavedMapContent>(
  snapshot: TSnapshot,
  operations: readonly MapOperation[]
): TSnapshot {
  const index = indexSavedMapContent(snapshot);

  for (const operation of operations) {
    applyOperationToSavedMapContentIndex(index, operation);
  }

  return materializeSavedMapContent(snapshot, index);
}
