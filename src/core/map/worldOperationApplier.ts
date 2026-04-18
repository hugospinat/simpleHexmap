import { hexKey } from "@/core/geometry/hex";
import type {
  FactionPatch,
  FeaturePatch,
  MapFeatureRecord,
  MapOperation,
  MapRiverRecord,
  MapRoadRecord,
  OperationApplier
} from "@/core/protocol";
import {
  getTileOperationTerrain,
  normalizeRoad,
  sanitizeFactionPatch,
  sanitizeFeaturePatch
} from "@/core/protocol";
import { applyRoadOperationToRecords } from "@/core/protocol";
import {
  addFaction,
  addFeature,
  addRiverEdge,
  addRoadConnection,
  addTile,
  assignFactionAt,
  clearFactionAt,
  featureHexIdToAxial,
  getCanonicalRiverEdgeRef,
  getFeatureById,
  getFactionLevelMap,
  getNeighborForRoadEdge,
  getRoadLevelMap,
  removeFaction,
  removeFeatureAt,
  removeRiverEdge,
  removeRoadConnectionsAt,
  removeTile,
  roadHexIdToAxial,
  setCellHidden,
  updateFaction,
  updateFeature,
  type FeatureKind,
  type LevelMap,
  type TerrainType,
  type MapState
} from "@/core/map/world";
import { SOURCE_LEVEL } from "@/core/map/mapRules";
import { bumpMapStateVersion } from "@/core/map/worldTypes";

type SetTileOperation = Extract<MapOperation, { type: "set_tile" }>;
type SetCellHiddenOperation = Extract<MapOperation, { type: "set_cell_hidden" }>;
type SetFactionTerritoryOperation = Extract<MapOperation, { type: "set_faction_territory" }>;

function applySetTileToWorld(world: MapState, tile: Extract<MapOperation, { type: "set_tile" }>["tile"]): MapState {
  const axial = { q: tile.q, r: tile.r };
  const terrain = getTileOperationTerrain(tile);

  if (terrain === null) {
    const withoutFaction = clearFactionAt(world, SOURCE_LEVEL, axial);
    return removeTile(withoutFaction, SOURCE_LEVEL, axial);
  }

  const withTile = addTile(world, SOURCE_LEVEL, axial, terrain as TerrainType);
  return setCellHidden(withTile, SOURCE_LEVEL, axial, tile.hidden ?? false);
}

function applyFeatureRecordToWorld(world: MapState, feature: MapFeatureRecord): MapState {
  if (getFeatureById(world, SOURCE_LEVEL, feature.id)) {
    return world;
  }

  return addFeature(world, SOURCE_LEVEL, {
    id: feature.id,
    kind: feature.kind as FeatureKind,
    hexId: hexKey({ q: feature.q, r: feature.r }),
    hidden: feature.visibility === "hidden",
    overrideTerrainTile: feature.overrideTerrainTile,
    gmLabel: feature.gmLabel ?? undefined,
    playerLabel: feature.playerLabel ?? undefined,
    labelRevealed: feature.labelRevealed
  });
}

function getSourceLevelMapForBatch(world: MapState): LevelMap {
  return world.levels[SOURCE_LEVEL] ?? new Map();
}

function cloneSourceLevelForBatch(current: LevelMap, next: LevelMap | null): LevelMap {
  return next ?? new Map(current);
}

function applySetTileOperationsToWorld(world: MapState, operations: readonly SetTileOperation[]): MapState {
  const sourceLevel = getSourceLevelMapForBatch(world);
  const sourceFactionAssignments = world.factionAssignmentsByLevel?.[SOURCE_LEVEL] ?? new Map<string, string>();
  let nextLevel: LevelMap | null = null;
  let nextFactionAssignments: Map<string, string> | null = null;
  let terrainChanged = false;
  let factionsChanged = false;

  for (const operation of operations) {
    const key = hexKey({ q: operation.tile.q, r: operation.tile.r });
    const terrain = getTileOperationTerrain(operation.tile);
    const currentLevel = nextLevel ?? sourceLevel;
    const currentCell = currentLevel.get(key);

    if (terrain === null) {
      if (!currentCell) {
        continue;
      }

      nextLevel = cloneSourceLevelForBatch(sourceLevel, nextLevel);
      nextLevel.delete(key);
      terrainChanged = true;

      const currentAssignments = nextFactionAssignments ?? sourceFactionAssignments;

      if (currentAssignments.has(key)) {
        nextFactionAssignments = nextFactionAssignments ?? new Map(sourceFactionAssignments);
        nextFactionAssignments.delete(key);
        factionsChanged = true;
      }

      continue;
    }

    const nextCell = {
      hidden: operation.tile.hidden ?? false,
      type: terrain as TerrainType
    };

    if (currentCell?.type === nextCell.type && currentCell.hidden === nextCell.hidden) {
      continue;
    }

    nextLevel = cloneSourceLevelForBatch(sourceLevel, nextLevel);
    nextLevel.set(key, nextCell);
    terrainChanged = true;
  }

  if (!terrainChanged && !factionsChanged) {
    return world;
  }

  let nextWorld = world;

  if (terrainChanged && nextLevel) {
    nextWorld = {
      ...nextWorld,
      levels: {
        ...nextWorld.levels,
        [SOURCE_LEVEL]: nextLevel
      },
      versions: bumpMapStateVersion(nextWorld, "terrain")
    };
  }

  if (factionsChanged && nextFactionAssignments) {
    nextWorld = {
      ...nextWorld,
      factionAssignmentsByLevel: {
        ...nextWorld.factionAssignmentsByLevel,
        [SOURCE_LEVEL]: nextFactionAssignments
      },
      versions: bumpMapStateVersion(nextWorld, "factions")
    };
  }

  return nextWorld;
}

function applyCellHiddenOperationsToWorld(world: MapState, operations: readonly SetCellHiddenOperation[]): MapState {
  const sourceLevel = getSourceLevelMapForBatch(world);
  let nextLevel: LevelMap | null = null;

  for (const operation of operations) {
    const key = hexKey({ q: operation.cell.q, r: operation.cell.r });
    const current = (nextLevel ?? sourceLevel).get(key);

    if (!current || current.hidden === operation.cell.hidden) {
      continue;
    }

    nextLevel = cloneSourceLevelForBatch(sourceLevel, nextLevel);
    nextLevel.set(key, {
      ...current,
      hidden: operation.cell.hidden
    });
  }

  if (!nextLevel) {
    return world;
  }

  return {
    ...world,
    levels: {
      ...world.levels,
      [SOURCE_LEVEL]: nextLevel
    },
    versions: bumpMapStateVersion(world, "terrain")
  };
}

function applyFactionTerritoryOperationsToWorld(
  world: MapState,
  operations: readonly SetFactionTerritoryOperation[]
): MapState {
  const factions = world.factions ?? new Map();
  const sourceLevel = getSourceLevelMapForBatch(world);
  const sourceAssignments = getFactionLevelMap(world, SOURCE_LEVEL);
  let nextAssignments: Map<string, string> | null = null;

  for (const operation of operations) {
    const key = hexKey({ q: operation.territory.q, r: operation.territory.r });
    const factionId = operation.territory.factionId;

    if (!sourceLevel.has(key)) {
      continue;
    }

    if (factionId && !factions.has(factionId)) {
      continue;
    }

    const currentAssignments = nextAssignments ?? sourceAssignments;
    const currentFactionId = currentAssignments.get(key) ?? null;

    if (currentFactionId === factionId) {
      continue;
    }

    nextAssignments = nextAssignments ?? new Map(sourceAssignments);

    if (factionId === null) {
      nextAssignments.delete(key);
    } else {
      nextAssignments.set(key, factionId);
    }
  }

  if (!nextAssignments) {
    return world;
  }

  return {
    ...world,
    factionAssignmentsByLevel: {
      ...world.factionAssignmentsByLevel,
      [SOURCE_LEVEL]: nextAssignments
    },
    versions: bumpMapStateVersion(world, "factions")
  };
}

function isCanonicalRiverRecord(river: MapRiverRecord): boolean {
  const canonical = getCanonicalRiverEdgeRef({
    axial: { q: river.q, r: river.r },
    edge: river.edge
  });

  return canonical.axial.q === river.q
    && canonical.axial.r === river.r
    && canonical.edge === river.edge;
}

function applyFeaturePatchToWorld(world: MapState, featureId: string, patch: FeaturePatch): MapState {
  const sanitized = sanitizeFeaturePatch(patch);
  const updates: Parameters<typeof updateFeature>[3] = {};

  if (typeof sanitized.kind === "string") {
    updates.kind = sanitized.kind as FeatureKind;
  }
  if (sanitized.visibility === "hidden" || sanitized.visibility === "visible") {
    updates.hidden = sanitized.visibility === "hidden";
  }
  if (typeof sanitized.overrideTerrainTile === "boolean") {
    updates.overrideTerrainTile = sanitized.overrideTerrainTile;
  }
  if (typeof sanitized.gmLabel === "string" || sanitized.gmLabel === null) {
    updates.gmLabel = sanitized.gmLabel ?? undefined;
  }
  if (typeof sanitized.playerLabel === "string" || sanitized.playerLabel === null) {
    updates.playerLabel = sanitized.playerLabel ?? undefined;
  }
  if (typeof sanitized.labelRevealed === "boolean") {
    updates.labelRevealed = sanitized.labelRevealed;
  }

  return updateFeature(world, SOURCE_LEVEL, featureId, updates);
}

function applyRemoveFeatureToWorld(world: MapState, featureId: string): MapState {
  const feature = getFeatureById(world, SOURCE_LEVEL, featureId);

  if (!feature) {
    return world;
  }

  return removeFeatureAt(world, SOURCE_LEVEL, featureHexIdToAxial(feature.hexId));
}

function getRoadRecordsFromWorld(world: MapState): MapRoadRecord[] {
  const roads = getRoadLevelMap(world, SOURCE_LEVEL);

  return Array.from(roads.entries()).map(([hexId, edges]) => {
    const axial = roadHexIdToAxial(hexId);

    return normalizeRoad({
      q: axial.q,
      r: axial.r,
      edges: Array.from(edges)
    });
  });
}

function applyRoadOperationToWorld(
  world: MapState,
  operation: Extract<MapOperation, { type: "add_road_data" | "update_road_data" | "remove_road_data" }>
): MapState {
  const updatedRoadRecords = applyRoadOperationToRecords(getRoadRecordsFromWorld(world), operation);
  let nextWorld: MapState = {
    ...world,
    roadsByLevel: {
      ...world.roadsByLevel,
      [SOURCE_LEVEL]: new Map()
    },
    versions: bumpMapStateVersion(world, "roads")
  };

  for (const road of updatedRoadRecords) {
    const from = { q: road.q, r: road.r };

    for (const edge of road.edges) {
      const to = getNeighborForRoadEdge(from, edge);
      nextWorld = addRoadConnection(nextWorld, SOURCE_LEVEL, from, to);
    }
  }

  return nextWorld;
}

export function applyOperationToWorld(world: MapState, operation: MapOperation): MapState {
  switch (operation.type) {
    case "set_tile":
      return applySetTileToWorld(world, operation.tile);
    case "set_cell_hidden":
      return setCellHidden(world, SOURCE_LEVEL, { q: operation.cell.q, r: operation.cell.r }, operation.cell.hidden);
    case "add_feature":
      return applyFeatureRecordToWorld(world, operation.feature);
    case "set_feature_hidden":
      return updateFeature(world, SOURCE_LEVEL, operation.featureId, { hidden: operation.hidden });
    case "update_feature":
      return applyFeaturePatchToWorld(world, operation.featureId, operation.patch);
    case "remove_feature":
      return applyRemoveFeatureToWorld(world, operation.featureId);
    case "add_river_data":
      return addRiverEdge(world, SOURCE_LEVEL, {
        axial: { q: operation.river.q, r: operation.river.r },
        edge: operation.river.edge
      });
    case "remove_river_data":
      if (!isCanonicalRiverRecord(operation.river)) {
        return world;
      }

      return removeRiverEdge(world, SOURCE_LEVEL, {
        axial: { q: operation.river.q, r: operation.river.r },
        edge: operation.river.edge
      });
    case "add_road_data":
      return applyRoadOperationToWorld(world, operation);
    case "update_road_data":
      return applyRoadOperationToWorld(world, operation);
    case "remove_road_data":
      return applyRoadOperationToWorld(world, operation);
    case "add_road_connection":
      return addRoadConnection(
        world,
        SOURCE_LEVEL,
        { q: operation.from.q, r: operation.from.r },
        { q: operation.to.q, r: operation.to.r }
      );
    case "remove_road_connections_at":
      return removeRoadConnectionsAt(world, SOURCE_LEVEL, { q: operation.cell.q, r: operation.cell.r });
    case "add_faction":
      return addFaction(world, operation.faction);
    case "update_faction": {
      const patch: FactionPatch = sanitizeFactionPatch(operation.patch);
      return updateFaction(world, operation.factionId, patch);
    }
    case "remove_faction":
      return removeFaction(world, operation.factionId);
    case "set_faction_territory": {
      const axial = { q: operation.territory.q, r: operation.territory.r };

      if (operation.territory.factionId === null) {
        return clearFactionAt(world, SOURCE_LEVEL, axial);
      }

      return assignFactionAt(world, SOURCE_LEVEL, axial, operation.territory.factionId);
    }
    case "rename_map":
      return world;
    default: {
      const exhaustive: never = operation;
      void exhaustive;
      return world;
    }
  }
}

export function applyOperationsToWorld(world: MapState, operations: readonly MapOperation[]): MapState {
  let nextWorld = world;
  let index = 0;

  while (index < operations.length) {
    const operation = operations[index];

    if (operation.type === "set_tile") {
      const batch: SetTileOperation[] = [];

      while (index < operations.length && operations[index].type === "set_tile") {
        batch.push(operations[index] as SetTileOperation);
        index += 1;
      }

      nextWorld = applySetTileOperationsToWorld(nextWorld, batch);
      continue;
    }

    if (operation.type === "set_cell_hidden") {
      const batch: SetCellHiddenOperation[] = [];

      while (index < operations.length && operations[index].type === "set_cell_hidden") {
        batch.push(operations[index] as SetCellHiddenOperation);
        index += 1;
      }

      nextWorld = applyCellHiddenOperationsToWorld(nextWorld, batch);
      continue;
    }

    if (operation.type === "set_faction_territory") {
      const batch: SetFactionTerritoryOperation[] = [];

      while (index < operations.length && operations[index].type === "set_faction_territory") {
        batch.push(operations[index] as SetFactionTerritoryOperation);
        index += 1;
      }

      nextWorld = applyFactionTerritoryOperationsToWorld(nextWorld, batch);
      continue;
    }

    nextWorld = applyOperationToWorld(nextWorld, operation);
    index += 1;
  }

  return nextWorld;
}

export const mapStateOperationApplier: OperationApplier<MapState> = {
  apply: applyOperationToWorld,
  applyMany: applyOperationsToWorld
};

export const applyMapOperationToWorld = applyOperationToWorld;
