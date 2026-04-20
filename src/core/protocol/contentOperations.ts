import type { OperationApplier } from "./operationContracts.js";
import type {
  MapDocument,
  MapFactionRecord,
  MapFactionTerritoryRecord,
  MapFeatureRecord,
  MapOperation,
  MapRiverRecord,
  MapRoadRecord,
  MapTileRecord,
} from "./types.js";
import {
  normalizeRoad,
  riverKey,
  roadKey,
  sanitizeFactionPatch,
  sanitizeFeaturePatch,
  tileKey,
} from "./recordHelpers.js";

export function applyOperationToMapDocument<TSnapshot extends MapDocument>(
  snapshot: TSnapshot,
  operation: MapOperation,
): TSnapshot {
  switch (operation.type) {
    case "set_tiles":
    case "set_faction_territories":
      return applyOperationsToMapDocumentIndexed(snapshot, [operation]);
    case "add_feature": {
      if (
        snapshot.features.some((feature) => feature.id === operation.feature.id)
      ) {
        return snapshot;
      }

      return {
        ...snapshot,
        features: [...snapshot.features, operation.feature],
      };
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
          ...patch,
        };
      });

      return changed ? { ...snapshot, features } : snapshot;
    }
    case "remove_feature":
      return {
        ...snapshot,
        features: snapshot.features.filter(
          (feature) => feature.id !== operation.featureId,
        ),
      };
    case "add_river_data": {
      const key = riverKey(operation.river);

      if (snapshot.rivers.some((river) => riverKey(river) === key)) {
        return snapshot;
      }

      return {
        ...snapshot,
        rivers: [...snapshot.rivers, operation.river],
      };
    }
    case "remove_river_data":
      return {
        ...snapshot,
        rivers: snapshot.rivers.filter(
          (river) => riverKey(river) !== riverKey(operation.river),
        ),
      };
    case "set_road_edges": {
      const key = roadKey(operation.cell);
      const roads = snapshot.roads.filter((road) => roadKey(road) !== key);

      if (operation.edges.length > 0) {
        roads.push(
          normalizeRoad({
            q: operation.cell.q,
            r: operation.cell.r,
            edges: operation.edges,
          }),
        );
      }

      return {
        ...snapshot,
        roads,
      };
    }
    case "add_faction": {
      if (
        snapshot.factions.some((faction) => faction.id === operation.faction.id)
      ) {
        return snapshot;
      }

      return {
        ...snapshot,
        factions: [...snapshot.factions, operation.faction],
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
          ...patch,
        };
      });

      return changed ? { ...snapshot, factions } : snapshot;
    }
    case "remove_faction":
      return {
        ...snapshot,
        factions: snapshot.factions.filter(
          (faction) => faction.id !== operation.factionId,
        ),
        factionTerritories: snapshot.factionTerritories.filter(
          (territory) => territory.factionId !== operation.factionId,
        ),
      };
    default: {
      const exhaustive: never = operation;
      void exhaustive;
      return snapshot;
    }
  }
}

export function applyOperationsToMapDocument<TSnapshot extends MapDocument>(
  snapshot: TSnapshot,
  operations: readonly MapOperation[],
): TSnapshot {
  if (operations.length === 0) {
    return snapshot;
  }

  return applyOperationsToMapDocumentIndexed(snapshot, operations);
}

export const mapDocumentOperationApplier: OperationApplier<MapDocument> = {
  apply: applyOperationToMapDocument,
  applyMany: applyOperationsToMapDocument,
};

export const applyMapDocumentOperation = applyOperationToMapDocument;
export const applyMapDocumentOperations = applyOperationsToMapDocument;

export type MapDocumentIndex = {
  factionTerritoriesByHex: Map<string, MapFactionTerritoryRecord>;
  factionsById: Map<string, MapFactionRecord>;
  featuresById: Map<string, MapFeatureRecord>;
  riversByKey: Map<string, MapRiverRecord>;
  roads: MapRoadRecord[];
  tilesByHex: Map<string, MapTileRecord>;
};

export function indexMapDocument(snapshot: MapDocument): MapDocumentIndex {
  return {
    factionTerritoriesByHex: new Map(
      snapshot.factionTerritories.map((territory) => [
        tileKey(territory),
        territory,
      ]),
    ),
    factionsById: new Map(
      snapshot.factions.map((faction) => [faction.id, faction]),
    ),
    featuresById: new Map(
      snapshot.features.map((feature) => [feature.id, feature]),
    ),
    riversByKey: new Map(
      snapshot.rivers.map((river) => [riverKey(river), river]),
    ),
    roads: snapshot.roads,
    tilesByHex: new Map(snapshot.tiles.map((tile) => [tileKey(tile), tile])),
  };
}

export function materializeMapDocument<TSnapshot extends MapDocument>(
  snapshot: TSnapshot,
  index: MapDocumentIndex,
): TSnapshot {
  return {
    ...snapshot,
    tiles: Array.from(index.tilesByHex.values()),
    features: Array.from(index.featuresById.values()),
    rivers: Array.from(index.riversByKey.values()),
    roads: index.roads,
    factions: Array.from(index.factionsById.values()),
    factionTerritories: Array.from(index.factionTerritoriesByHex.values()),
  };
}

export function applyOperationToMapDocumentIndex(
  index: MapDocumentIndex,
  operation: MapOperation,
): void {
  switch (operation.type) {
    case "set_tiles": {
      for (const tile of operation.tiles) {
        const key = tileKey(tile);
        index.tilesByHex.delete(key);

        if (tile.terrain === null) {
          index.factionTerritoriesByHex.delete(key);
          continue;
        }

        index.tilesByHex.set(key, {
          hidden: tile.hidden,
          q: tile.q,
          r: tile.r,
          terrain: tile.terrain,
        });
      }
      return;
    }
    case "set_faction_territories": {
      for (const territory of operation.territories) {
        const key = tileKey(territory);
        index.factionTerritoriesByHex.delete(key);

        if (territory.factionId) {
          index.factionTerritoriesByHex.set(key, {
            q: territory.q,
            r: territory.r,
            factionId: territory.factionId,
          });
        }
      }
      return;
    }
    case "add_feature": {
      if (index.featuresById.has(operation.feature.id)) {
        return;
      }

      index.featuresById.set(operation.feature.id, operation.feature);
      return;
    }
    case "update_feature": {
      const feature = index.featuresById.get(operation.featureId);

      if (!feature) {
        return;
      }

      index.featuresById.set(operation.featureId, {
        ...feature,
        ...sanitizeFeaturePatch(operation.patch),
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
    case "set_road_edges": {
      const key = roadKey(operation.cell);
      index.roads = index.roads.filter((road) => roadKey(road) !== key);

      if (operation.edges.length > 0) {
        index.roads.push(
          normalizeRoad({
            q: operation.cell.q,
            r: operation.cell.r,
            edges: operation.edges,
          }),
        );
      }
      return;
    }
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
        ...sanitizeFactionPatch(operation.patch),
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
    default: {
      const exhaustive: never = operation;
      void exhaustive;
    }
  }
}

function applyOperationsToMapDocumentIndexed<TSnapshot extends MapDocument>(
  snapshot: TSnapshot,
  operations: readonly MapOperation[],
): TSnapshot {
  const index = indexMapDocument(snapshot);

  for (const operation of operations) {
    applyOperationToMapDocumentIndex(index, operation);
  }

  return materializeMapDocument(snapshot, index);
}
