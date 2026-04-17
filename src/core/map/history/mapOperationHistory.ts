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
  type MapState
} from "@/core/map/world";
import { applyOperationToWorld } from "@/core/map/worldOperationApplier";
import type {
  FactionPatch,
  FeaturePatch,
  MapFeatureRecord,
  MapOperation,
  MapRoadRecord
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
    undoStack: []
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
    q: axial.q,
    r: axial.r,
    visibility: feature.hidden ? "hidden" : "visible",
    overrideTerrainTile: feature.overrideTerrainTile,
    gmLabel: feature.gmLabel ?? null,
    playerLabel: feature.playerLabel ?? null,
    labelRevealed: feature.labelRevealed ?? false
  };
}

function roadRecordsByKey(world: MapState): Map<string, MapRoadRecord> {
  const records = new Map<string, MapRoadRecord>();

  for (const [hexId, edges] of getRoadLevelMap(world, SOURCE_LEVEL).entries()) {
    const axial = roadHexIdToAxial(hexId);
    records.set(hexKey(axial), {
      q: axial.q,
      r: axial.r,
      edges: Array.from(edges).sort((left, right) => left - right)
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

function roadRestoreOperations(targetWorld: MapState, currentWorld: MapState): MapOperation[] {
  const targetRecords = roadRecordsByKey(targetWorld);
  const currentRecords = roadRecordsByKey(currentWorld);
  const operations: MapOperation[] = [];

  for (const [key, current] of currentRecords.entries()) {
    const target = targetRecords.get(key);

    if (!target) {
      operations.push({
        type: "remove_road_data",
        road: {
          q: current.q,
          r: current.r
        }
      });
      continue;
    }

    if (!sameRoadEdges(current.edges, target.edges)) {
      operations.push({
        type: "update_road_data",
        road: target
      });
    }
  }

  for (const [key, target] of targetRecords.entries()) {
    if (currentRecords.has(key)) {
      continue;
    }

    operations.push({
      type: "add_road_data",
      road: target
    });
  }

  return operations;
}

function featurePatchForPreviousValues(feature: Feature, patch: FeaturePatch): FeaturePatch {
  const inverse: FeaturePatch = {};

  if ("kind" in patch || "type" in patch) {
    inverse.kind = feature.kind;
  }
  if ("visibility" in patch) {
    inverse.visibility = feature.hidden ? "hidden" : "visible";
  }
  if ("overrideTerrainTile" in patch) {
    inverse.overrideTerrainTile = feature.overrideTerrainTile;
  }
  if ("gmLabel" in patch) {
    inverse.gmLabel = feature.gmLabel ?? null;
  }
  if ("playerLabel" in patch) {
    inverse.playerLabel = feature.playerLabel ?? null;
  }
  if ("labelRevealed" in patch) {
    inverse.labelRevealed = feature.labelRevealed;
  }

  return inverse;
}

function factionPatchForPreviousValues(world: MapState, factionId: string, patch: FactionPatch): FactionPatch {
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

function inverseForOperation(worldBefore: MapState, operation: MapOperation): MapOperation[] {
  const sourceMap = worldBefore.levels[SOURCE_LEVEL] ?? new Map();

  switch (operation.type) {
    case "set_tile": {
      const axial = { q: operation.tile.q, r: operation.tile.r };
      const key = hexKey(axial);
      const previousTile = sourceMap.get(key);
      const previousFactionId = getFactionLevelMap(worldBefore, SOURCE_LEVEL).get(key) ?? null;
      const inverse: MapOperation[] = previousTile
        ? [{
          type: "set_tile",
          tile: {
            q: axial.q,
            r: axial.r,
            terrain: previousTile.type,
            hidden: previousTile.hidden
          }
        }]
        : [{
          type: "set_tile",
          tile: {
            q: axial.q,
            r: axial.r,
            terrain: null,
            hidden: false
          }
        }];

      if (previousTile && previousFactionId) {
        inverse.push({
          type: "set_faction_territory",
          territory: {
            q: axial.q,
            r: axial.r,
            factionId: previousFactionId
          }
        });
      }

      return inverse;
    }

    case "set_cell_hidden": {
      const previousTile = sourceMap.get(hexKey({ q: operation.cell.q, r: operation.cell.r }));
      return previousTile
        ? [{
          type: "set_cell_hidden",
          cell: {
            q: operation.cell.q,
            r: operation.cell.r,
            hidden: previousTile.hidden
          }
        }]
        : [];
    }

    case "add_feature":
      return getFeatureById(worldBefore, SOURCE_LEVEL, operation.feature.id)
        ? []
        : [{ type: "remove_feature", featureId: operation.feature.id }];

    case "set_feature_hidden": {
      const feature = getFeatureById(worldBefore, SOURCE_LEVEL, operation.featureId);
      return feature
        ? [{ type: "set_feature_hidden", featureId: operation.featureId, hidden: feature.hidden }]
        : [];
    }

    case "update_feature": {
      const feature = getFeatureById(worldBefore, SOURCE_LEVEL, operation.featureId);
      const patch = feature ? featurePatchForPreviousValues(feature, operation.patch) : {};
      return Object.keys(patch).length > 0
        ? [{ type: "update_feature", featureId: operation.featureId, patch }]
        : [];
    }

    case "remove_feature": {
      const feature = getFeatureById(worldBefore, SOURCE_LEVEL, operation.featureId);
      return feature
        ? [{ type: "add_feature", feature: featureToRecord(feature) }]
        : [];
    }

    case "add_river_data": {
      const hadRiver = getRiverLevelMap(worldBefore, SOURCE_LEVEL)
        .get(hexKey({ q: operation.river.q, r: operation.river.r }))
        ?.has(operation.river.edge) ?? false;
      return hadRiver ? [] : [{ type: "remove_river_data", river: operation.river }];
    }

    case "remove_river_data": {
      const hadRiver = getRiverLevelMap(worldBefore, SOURCE_LEVEL)
        .get(hexKey({ q: operation.river.q, r: operation.river.r }))
        ?.has(operation.river.edge) ?? false;
      return hadRiver ? [{ type: "add_river_data", river: operation.river }] : [];
    }

    case "add_road_data":
    case "update_road_data":
    case "remove_road_data":
    case "add_road_connection":
    case "remove_road_connections_at":
      return roadRestoreOperations(worldBefore, applyOperationToWorld(worldBefore, operation));

    case "add_faction":
      return getFactionById(worldBefore, operation.faction.id)
        ? []
        : [{ type: "remove_faction", factionId: operation.faction.id }];

    case "update_faction": {
      const patch = factionPatchForPreviousValues(worldBefore, operation.factionId, operation.patch);
      return Object.keys(patch).length > 0
        ? [{ type: "update_faction", factionId: operation.factionId, patch }]
        : [];
    }

    case "remove_faction": {
      const faction = getFactionById(worldBefore, operation.factionId);

      if (!faction) {
        return [];
      }

      const inverse: MapOperation[] = [{ type: "add_faction", faction }];

      for (const [hexId, factionId] of getFactionLevelMap(worldBefore, SOURCE_LEVEL).entries()) {
        if (factionId !== operation.factionId) {
          continue;
        }

        const axial = parseHexKey(hexId);
        inverse.push({
          type: "set_faction_territory",
          territory: {
            q: axial.q,
            r: axial.r,
            factionId
          }
        });
      }

      return inverse;
    }

    case "set_faction_territory": {
      const previousFactionId = getFactionLevelMap(worldBefore, SOURCE_LEVEL)
        .get(hexKey({ q: operation.territory.q, r: operation.territory.r })) ?? null;
      return [{
        type: "set_faction_territory",
        territory: {
          q: operation.territory.q,
          r: operation.territory.r,
          factionId: previousFactionId
        }
      }];
    }

    case "rename_map":
      return [];

    default: {
      const exhaustive: never = operation;
      void exhaustive;
      return [];
    }
  }
}

export function invertOperationBatch(worldBefore: MapState, operations: MapOperation[]): MapOperation[] {
  const inverseByForwardOperation: MapOperation[][] = [];
  let currentWorld = worldBefore;

  for (const operation of operations) {
    inverseByForwardOperation.push(inverseForOperation(currentWorld, operation));
    currentWorld = applyOperationToWorld(currentWorld, operation);
  }

  return inverseByForwardOperation.reverse().flat();
}

export function recordOperationHistory(
  history: OperationHistoryState,
  worldBefore: MapState,
  operations: MapOperation[]
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
    undoOperations
  });
  history.redoStack = [];
}

export function takeUndoOperations(history: OperationHistoryState): MapOperation[] {
  const entry = history.undoStack.pop();

  if (!entry) {
    return [];
  }

  history.redoStack.push(entry);
  return entry.undoOperations;
}

export function takeRedoOperations(history: OperationHistoryState): MapOperation[] {
  const entry = history.redoStack.pop();

  if (!entry) {
    return [];
  }

  history.undoStack.push(entry);
  return entry.redoOperations;
}
