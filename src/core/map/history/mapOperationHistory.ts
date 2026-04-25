import { hexKey, parseHexKey } from "@/core/geometry/hex";
import { SOURCE_LEVEL } from "@/core/map/mapRules";
import {
  getFactionById,
  getFactionLevelMap,
  getFeatureById,
  getRoadLevelMap,
  getRiverLevelMap,
  roadHexIdToAxial,
  type Feature,
  type RoadEdgeIndex,
  type MapState,
} from "@/core/map/world";
import { applyOperationToWorld } from "@/core/map/worldOperationApplier";
import type {
  FactionPatch,
  FeaturePatch,
  MapFeatureRecord,
  MapOperation,
  MapRoadRecord,
} from "@/core/protocol";

export type OperationHistoryEntry = {
  redoOperations: MapOperation[];
  undoOperations: MapOperation[];
};

export type OperationHistoryState = {
  redoStack: OperationHistoryEntry[];
  undoStack: OperationHistoryEntry[];
};

export function createOperationHistoryState(): OperationHistoryState {
  return {
    redoStack: [],
    undoStack: [],
  };
}

export function clearOperationHistory(history: OperationHistoryState): void {
  history.redoStack = [];
  history.undoStack = [];
}

function featureToRecord(feature: Feature): MapFeatureRecord {
  const axial = parseHexKey(feature.hexId);

  return {
    id: feature.id,
    kind: feature.kind,
    featureLevel: feature.featureLevel,
    q: axial.q,
    r: axial.r,
    hidden: feature.hidden,
  };
}

function roadRecordsByKey(world: MapState): Map<string, MapRoadRecord> {
  const records = new Map<string, MapRoadRecord>();

  for (const [hexId, edges] of getRoadLevelMap(world, SOURCE_LEVEL).entries()) {
    const axial = roadHexIdToAxial(hexId);
    records.set(hexKey(axial), {
      q: axial.q,
      r: axial.r,
      edges: Array.from(edges).sort((left, right) => left - right),
    });
  }

  return records;
}

function sameRoadEdges(left: RoadEdgeIndex[], right: RoadEdgeIndex[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((edge, index) => edge === right[index]);
}

function roadRestoreOperations(
  targetWorld: MapState,
  currentWorld: MapState,
): MapOperation[] {
  const targetRecords = roadRecordsByKey(targetWorld);
  const currentRecords = roadRecordsByKey(currentWorld);
  const operations: MapOperation[] = [];

  for (const [key, current] of currentRecords.entries()) {
    const target = targetRecords.get(key);

    if (!target) {
      operations.push({
        type: "set_road_edges",
        cell: { q: current.q, r: current.r },
        edges: [],
      });
      continue;
    }

    if (!sameRoadEdges(current.edges, target.edges)) {
      operations.push({
        type: "set_road_edges",
        cell: { q: target.q, r: target.r },
        edges: target.edges,
      });
    }
  }

  for (const [key, target] of targetRecords.entries()) {
    if (currentRecords.has(key)) {
      continue;
    }

    operations.push({
      type: "set_road_edges",
      cell: { q: target.q, r: target.r },
      edges: target.edges,
    });
  }

  return operations;
}

function featurePatchForPreviousValues(
  feature: Feature,
  patch: FeaturePatch,
): FeaturePatch {
  const inverse: FeaturePatch = {};

  if ("hidden" in patch) {
    inverse.hidden = feature.hidden;
  }

  return inverse;
}

function factionPatchForPreviousValues(
  world: MapState,
  factionId: string,
  patch: FactionPatch,
): FactionPatch {
  const faction = getFactionById(world, factionId);
  const inverse: FactionPatch = {};

  if (!faction) {
    return inverse;
  }

  if ("name" in patch) {
    inverse.name = faction.name;
  }
  if ("color" in patch) {
    inverse.color = faction.color;
  }

  return inverse;
}

function inverseForOperation(
  worldBefore: MapState,
  operation: MapOperation,
): MapOperation[] {
  const sourceMap = worldBefore.levels[SOURCE_LEVEL] ?? new Map();
  const sourceFactions = getFactionLevelMap(worldBefore, SOURCE_LEVEL);

  switch (operation.type) {
    case "set_tiles": {
      const tiles = operation.tiles.map((tile) => {
        const previousTile = sourceMap.get(hexKey(tile));

        return {
          q: tile.q,
          r: tile.r,
          terrain: previousTile?.type ?? null,
          hidden: previousTile?.hidden ?? false,
        };
      });
      const factionTerritories = operation.tiles
        .map((tile) => ({
          q: tile.q,
          r: tile.r,
          factionId: sourceFactions.get(hexKey(tile)) ?? null,
        }))
        .filter((entry) => entry.factionId !== null);
      const inverse: MapOperation[] = [{ type: "set_tiles", tiles }];

      if (factionTerritories.length > 0) {
        inverse.push({
          type: "set_faction_territories",
          territories: factionTerritories,
        });
      }

      return inverse;
    }

    case "set_faction_territories": {
      const territories = operation.territories
        .filter((territory) => sourceMap.has(hexKey(territory)))
        .map((territory) => ({
          q: territory.q,
          r: territory.r,
          factionId: sourceFactions.get(hexKey(territory)) ?? null,
        }));

      return territories.length > 0
        ? [{ type: "set_faction_territories", territories }]
        : [];
    }

    case "add_feature":
      return getFeatureById(worldBefore, SOURCE_LEVEL, operation.feature.id)
        ? []
        : [{ type: "remove_feature", featureId: operation.feature.id }];

    case "update_feature": {
      const feature = getFeatureById(
        worldBefore,
        SOURCE_LEVEL,
        operation.featureId,
      );
      const patch = feature
        ? featurePatchForPreviousValues(feature, operation.patch)
        : {};
      return Object.keys(patch).length > 0
        ? [{ type: "update_feature", featureId: operation.featureId, patch }]
        : [];
    }

    case "remove_feature": {
      const feature = getFeatureById(
        worldBefore,
        SOURCE_LEVEL,
        operation.featureId,
      );
      return feature
        ? [{ type: "add_feature", feature: featureToRecord(feature) }]
        : [];
    }

    case "add_river_data": {
      const hadRiver =
        getRiverLevelMap(worldBefore, SOURCE_LEVEL)
          .get(hexKey({ q: operation.river.q, r: operation.river.r }))
          ?.has(operation.river.edge) ?? false;
      return hadRiver
        ? []
        : [{ type: "remove_river_data", river: operation.river }];
    }

    case "remove_river_data": {
      const hadRiver =
        getRiverLevelMap(worldBefore, SOURCE_LEVEL)
          .get(hexKey({ q: operation.river.q, r: operation.river.r }))
          ?.has(operation.river.edge) ?? false;
      return hadRiver
        ? [{ type: "add_river_data", river: operation.river }]
        : [];
    }

    case "set_road_edges":
      return roadRestoreOperations(
        worldBefore,
        applyOperationToWorld(worldBefore, operation),
      );

    case "add_faction":
      return getFactionById(worldBefore, operation.faction.id)
        ? []
        : [{ type: "remove_faction", factionId: operation.faction.id }];

    case "update_faction": {
      const patch = factionPatchForPreviousValues(
        worldBefore,
        operation.factionId,
        operation.patch,
      );
      return Object.keys(patch).length > 0
        ? [{ type: "update_faction", factionId: operation.factionId, patch }]
        : [];
    }

    case "remove_faction": {
      const faction = getFactionById(worldBefore, operation.factionId);

      if (!faction) {
        return [];
      }

      const territories = Array.from(
        getFactionLevelMap(worldBefore, SOURCE_LEVEL).entries(),
      )
        .filter(([, factionId]) => factionId === operation.factionId)
        .map(([hexId, factionId]) => {
          const axial = parseHexKey(hexId);

          return {
            q: axial.q,
            r: axial.r,
            factionId,
          };
        });

      const inverse: MapOperation[] = [{ type: "add_faction", faction }];

      if (territories.length > 0) {
        inverse.push({
          type: "set_faction_territories",
          territories,
        });
      }

      return inverse;
    }

    default: {
      const exhaustive: never = operation;
      void exhaustive;
      return [];
    }
  }
}

export function invertOperationBatch(
  worldBefore: MapState,
  operations: MapOperation[],
): MapOperation[] {
  const inverseByForwardOperation: MapOperation[][] = [];
  let currentWorld = worldBefore;

  for (const operation of operations) {
    inverseByForwardOperation.push(
      inverseForOperation(currentWorld, operation),
    );
    currentWorld = applyOperationToWorld(currentWorld, operation);
  }

  return inverseByForwardOperation.reverse().flat();
}

export function recordOperationHistory(
  history: OperationHistoryState,
  worldBefore: MapState,
  operations: MapOperation[],
): void {
  if (operations.length === 0) {
    return;
  }

  const undoOperations = invertOperationBatch(worldBefore, operations);

  if (undoOperations.length === 0) {
    return;
  }

  history.undoStack.push({
    redoOperations: operations,
    undoOperations,
  });
  history.redoStack = [];
}

export function takeUndoOperations(
  history: OperationHistoryState,
): MapOperation[] {
  const entry = history.undoStack.pop();

  if (!entry) {
    return [];
  }

  history.redoStack.push(entry);
  return entry.undoOperations;
}

export function takeRedoOperations(
  history: OperationHistoryState,
): MapOperation[] {
  const entry = history.redoStack.pop();

  if (!entry) {
    return [];
  }

  history.undoStack.push(entry);
  return entry.redoOperations;
}
