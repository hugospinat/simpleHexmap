import type { OperationApplier } from "./operationContracts.js";
import type {
  MapFactionRecord,
  MapFactionTerritoryRecord,
  MapFeatureRecord,
  MapOperation,
  MapRiverRecord,
  MapRoadRecord,
  MapTileRecord,
  MapTokenRecord,
  SavedMapContent,
} from "./types.js";
import {
  normalizeRoad,
  riverKey,
  roadKey,
  sanitizeFactionPatch,
  sanitizeFeaturePatch,
  tileKey,
} from "./recordHelpers.js";

export function applyOperationToSavedMapContent<
  TSnapshot extends SavedMapContent,
>(snapshot: TSnapshot, operation: MapOperation): TSnapshot {
  switch (operation.type) {
    case "paint_cells":
    case "set_cells_hidden":
    case "assign_faction_cells":
    case "set_tiles":
    case "set_faction_territories":
      return applyOperationsToSavedMapContentIndexed(snapshot, [operation]);
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
    case "set_feature_hidden": {
      const visibility: "hidden" | "visible" = operation.hidden
        ? "hidden"
        : "visible";
      let changed = false;
      const features = snapshot.features.map((feature) => {
        if (
          feature.id !== operation.featureId ||
          feature.visibility === visibility
        ) {
          return feature;
        }

        changed = true;
        return {
          ...feature,
          visibility,
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
    case "rename_map":
      return snapshot;
    default: {
      const exhaustive: never = operation;
      void exhaustive;
      return snapshot;
    }
  }
}

export function applyOperationsToSavedMapContent<
  TSnapshot extends SavedMapContent,
>(snapshot: TSnapshot, operations: readonly MapOperation[]): TSnapshot {
  if (operations.length === 0) {
    return snapshot;
  }

  return applyOperationsToSavedMapContentIndexed(snapshot, operations);
}

export const savedMapContentOperationApplier: OperationApplier<SavedMapContent> =
  {
    apply: applyOperationToSavedMapContent,
    applyMany: applyOperationsToSavedMapContent,
  };

export const applyMapOperation = applyOperationToSavedMapContent;
export const applyMapOperations = applyOperationsToSavedMapContent;

export type SavedMapContentIndex = {
  factionTerritoriesByHex: Map<string, MapFactionTerritoryRecord>;
  factionsById: Map<string, MapFactionRecord>;
  featuresById: Map<string, MapFeatureRecord>;
  riversByKey: Map<string, MapRiverRecord>;
  roads: MapRoadRecord[];
  tilesByHex: Map<string, MapTileRecord>;
  tokensByUserId: Map<string, MapTokenRecord>;
};

export function indexSavedMapContent(
  snapshot: SavedMapContent,
): SavedMapContentIndex {
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
    tokensByUserId: new Map(
      snapshot.tokens.map((token) => [token.userId, token]),
    ),
  };
}

export function materializeSavedMapContent<TSnapshot extends SavedMapContent>(
  snapshot: TSnapshot,
  index: SavedMapContentIndex,
): TSnapshot {
  return {
    ...snapshot,
    tiles: Array.from(index.tilesByHex.values()),
    features: Array.from(index.featuresById.values()),
    rivers: Array.from(index.riversByKey.values()),
    roads: index.roads,
    factions: Array.from(index.factionsById.values()),
    factionTerritories: Array.from(index.factionTerritoriesByHex.values()),
    tokens: Array.from(index.tokensByUserId.values()),
  };
}

export function applyOperationToSavedMapContentIndex(
  index: SavedMapContentIndex,
  operation: MapOperation,
): void {
  switch (operation.type) {
    case "paint_cells": {
      for (const cell of operation.cells) {
        const key = tileKey(cell);
        index.tilesByHex.delete(key);

        if (operation.terrain === null) {
          index.factionTerritoriesByHex.delete(key);
          continue;
        }

        index.tilesByHex.set(key, {
          hidden: operation.hidden,
          q: cell.q,
          r: cell.r,
          terrain: operation.terrain,
        });
      }
      return;
    }
    case "set_cells_hidden": {
      for (const cell of operation.cells) {
        const key = tileKey(cell);
        const tile = index.tilesByHex.get(key);

        if (!tile || tile.hidden === operation.hidden) {
          continue;
        }

        index.tilesByHex.set(key, {
          ...tile,
          hidden: operation.hidden,
        });
      }
      return;
    }
    case "assign_faction_cells": {
      for (const cell of operation.cells) {
        const key = tileKey(cell);
        index.factionTerritoriesByHex.delete(key);

        if (operation.factionId) {
          index.factionTerritoriesByHex.set(key, {
            q: cell.q,
            r: cell.r,
            factionId: operation.factionId,
          });
        }
      }
      return;
    }
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
    case "set_feature_hidden": {
      const feature = index.featuresById.get(operation.featureId);
      const visibility: "hidden" | "visible" = operation.hidden
        ? "hidden"
        : "visible";

      if (!feature || feature.visibility === visibility) {
        return;
      }

      index.featuresById.set(operation.featureId, {
        ...feature,
        visibility,
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
    case "rename_map":
      return;
    default: {
      const exhaustive: never = operation;
      void exhaustive;
    }
  }
}

function applyOperationsToSavedMapContentIndexed<
  TSnapshot extends SavedMapContent,
>(snapshot: TSnapshot, operations: readonly MapOperation[]): TSnapshot {
  const index = indexSavedMapContent(snapshot);

  for (const operation of operations) {
    applyOperationToSavedMapContentIndex(index, operation);
  }

  return materializeSavedMapContent(snapshot, index);
}
