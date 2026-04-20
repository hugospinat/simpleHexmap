import { hexKey } from "@/core/geometry/hex";
import type {
  FactionPatch,
  FeaturePatch,
  MapFeatureRecord,
  MapOperation,
  MapRiverRecord,
  OperationApplier,
} from "@/core/protocol";
import { sanitizeFactionPatch, sanitizeFeaturePatch } from "@/core/protocol";
import {
  addFaction,
  addFeature,
  addRiverEdge,
  addTile,
  clearFactionAt,
  featureHexIdToAxial,
  getCanonicalRiverEdgeRef,
  getFeatureById,
  getFactionLevelMap,
  removeFaction,
  removeFeatureAt,
  removeRiverEdge,
  removeTile,
  setCellHidden,
  setRoadEdgesAt,
  updateFaction,
  updateFeature,
  type FeatureKind,
  type LevelMap,
  type TerrainType,
  type MapState,
} from "@/core/map/world";
import { SOURCE_LEVEL } from "@/core/map/mapRules";
import { bumpMapStateVersion } from "@/core/map/worldTypes";

type TileMutation = {
  q: number;
  r: number;
  terrain: string | null;
  hidden: boolean;
};

type HiddenMutation = {
  q: number;
  r: number;
  hidden: boolean;
};

type TerritoryMutation = {
  q: number;
  r: number;
  factionId: string | null;
};

function applyFeatureRecordToWorld(
  world: MapState,
  feature: MapFeatureRecord,
): MapState {
  if (getFeatureById(world, SOURCE_LEVEL, feature.id)) {
    return world;
  }

  return addFeature(world, SOURCE_LEVEL, {
    id: feature.id,
    kind: feature.kind as FeatureKind,
    hexId: hexKey({ q: feature.q, r: feature.r }),
    hidden: feature.hidden,
    gmLabel: feature.gmLabel ?? undefined,
    playerLabel: feature.playerLabel ?? undefined,
    labelRevealed: feature.labelRevealed,
  });
}

function getSourceLevelMapForBatch(world: MapState): LevelMap {
  return world.levels[SOURCE_LEVEL] ?? new Map();
}

function cloneSourceLevelForBatch(
  current: LevelMap,
  next: LevelMap | null,
): LevelMap {
  return next ?? new Map(current);
}

function applySetTileOperationsToWorld(
  world: MapState,
  operations: readonly TileMutation[],
): MapState {
  const sourceLevel = getSourceLevelMapForBatch(world);
  const sourceFactionAssignments =
    world.factionAssignmentsByLevel?.[SOURCE_LEVEL] ??
    new Map<string, string>();
  let nextLevel: LevelMap | null = null;
  let nextFactionAssignments: Map<string, string> | null = null;
  let terrainChanged = false;
  let factionsChanged = false;

  for (const operation of operations) {
    const key = hexKey({ q: operation.q, r: operation.r });
    const terrain = operation.terrain;
    const currentLevel = nextLevel ?? sourceLevel;
    const currentCell = currentLevel.get(key);

    if (terrain === null) {
      if (!currentCell) {
        continue;
      }

      nextLevel = cloneSourceLevelForBatch(sourceLevel, nextLevel);
      nextLevel.delete(key);
      terrainChanged = true;

      const currentAssignments =
        nextFactionAssignments ?? sourceFactionAssignments;

      if (currentAssignments.has(key)) {
        nextFactionAssignments =
          nextFactionAssignments ?? new Map(sourceFactionAssignments);
        nextFactionAssignments.delete(key);
        factionsChanged = true;
      }

      continue;
    }

    const nextCell = {
      hidden: operation.hidden,
      type: terrain as TerrainType,
    };

    if (
      currentCell?.type === nextCell.type &&
      currentCell.hidden === nextCell.hidden
    ) {
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
        [SOURCE_LEVEL]: nextLevel,
      },
      versions: bumpMapStateVersion(nextWorld, "terrain"),
    };
  }

  if (factionsChanged && nextFactionAssignments) {
    nextWorld = {
      ...nextWorld,
      factionAssignmentsByLevel: {
        ...nextWorld.factionAssignmentsByLevel,
        [SOURCE_LEVEL]: nextFactionAssignments,
      },
      versions: bumpMapStateVersion(nextWorld, "factions"),
    };
  }

  return nextWorld;
}

function applyCellHiddenOperationsToWorld(
  world: MapState,
  operations: readonly HiddenMutation[],
): MapState {
  const sourceLevel = getSourceLevelMapForBatch(world);
  let nextLevel: LevelMap | null = null;

  for (const operation of operations) {
    const key = hexKey({ q: operation.q, r: operation.r });
    const current = (nextLevel ?? sourceLevel).get(key);

    if (!current || current.hidden === operation.hidden) {
      continue;
    }

    nextLevel = cloneSourceLevelForBatch(sourceLevel, nextLevel);
    nextLevel.set(key, {
      ...current,
      hidden: operation.hidden,
    });
  }

  if (!nextLevel) {
    return world;
  }

  return {
    ...world,
    levels: {
      ...world.levels,
      [SOURCE_LEVEL]: nextLevel,
    },
    versions: bumpMapStateVersion(world, "terrain"),
  };
}

function applyFactionTerritoryOperationsToWorld(
  world: MapState,
  operations: readonly TerritoryMutation[],
): MapState {
  const factions = world.factions ?? new Map();
  const sourceLevel = getSourceLevelMapForBatch(world);
  const sourceAssignments = getFactionLevelMap(world, SOURCE_LEVEL);
  let nextAssignments: Map<string, string> | null = null;

  for (const operation of operations) {
    const key = hexKey({ q: operation.q, r: operation.r });
    const factionId = operation.factionId;

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
      [SOURCE_LEVEL]: nextAssignments,
    },
    versions: bumpMapStateVersion(world, "factions"),
  };
}

function isCanonicalRiverRecord(river: MapRiverRecord): boolean {
  const canonical = getCanonicalRiverEdgeRef({
    axial: { q: river.q, r: river.r },
    edge: river.edge,
  });

  return (
    canonical.axial.q === river.q &&
    canonical.axial.r === river.r &&
    canonical.edge === river.edge
  );
}

function applyFeaturePatchToWorld(
  world: MapState,
  featureId: string,
  patch: FeaturePatch,
): MapState {
  const sanitized = sanitizeFeaturePatch(patch);
  const updates: Parameters<typeof updateFeature>[3] = {};

  if (typeof sanitized.kind === "string") {
    updates.kind = sanitized.kind as FeatureKind;
  }
  if (typeof sanitized.hidden === "boolean") {
    updates.hidden = sanitized.hidden;
  }
  if (typeof sanitized.gmLabel === "string" || sanitized.gmLabel === null) {
    updates.gmLabel = sanitized.gmLabel ?? undefined;
  }
  if (
    typeof sanitized.playerLabel === "string" ||
    sanitized.playerLabel === null
  ) {
    updates.playerLabel = sanitized.playerLabel ?? undefined;
  }
  if (typeof sanitized.labelRevealed === "boolean") {
    updates.labelRevealed = sanitized.labelRevealed;
  }

  return updateFeature(world, SOURCE_LEVEL, featureId, updates);
}

function applyRemoveFeatureToWorld(
  world: MapState,
  featureId: string,
): MapState {
  const feature = getFeatureById(world, SOURCE_LEVEL, featureId);

  if (!feature) {
    return world;
  }

  return removeFeatureAt(
    world,
    SOURCE_LEVEL,
    featureHexIdToAxial(feature.hexId),
  );
}

export function applyOperationToWorld(
  world: MapState,
  operation: MapOperation,
): MapState {
  switch (operation.type) {
    case "set_tiles":
      return applySetTileOperationsToWorld(
        world,
        operation.tiles.map((tile) => ({
          q: tile.q,
          r: tile.r,
          terrain: tile.terrain,
          hidden: tile.hidden,
        })),
      );
    case "set_faction_territories":
      return applyFactionTerritoryOperationsToWorld(
        world,
        operation.territories.map((territory) => ({
          q: territory.q,
          r: territory.r,
          factionId: territory.factionId,
        })),
      );
    case "add_feature":
      return applyFeatureRecordToWorld(world, operation.feature);
    case "update_feature":
      return applyFeaturePatchToWorld(
        world,
        operation.featureId,
        operation.patch,
      );
    case "remove_feature":
      return applyRemoveFeatureToWorld(world, operation.featureId);
    case "add_river_data":
      return addRiverEdge(world, SOURCE_LEVEL, {
        axial: { q: operation.river.q, r: operation.river.r },
        edge: operation.river.edge,
      });
    case "remove_river_data":
      if (!isCanonicalRiverRecord(operation.river)) {
        return world;
      }

      return removeRiverEdge(world, SOURCE_LEVEL, {
        axial: { q: operation.river.q, r: operation.river.r },
        edge: operation.river.edge,
      });
    case "set_road_edges":
      return setRoadEdgesAt(
        world,
        SOURCE_LEVEL,
        { q: operation.cell.q, r: operation.cell.r },
        new Set(operation.edges),
      );
    case "add_faction":
      return addFaction(world, operation.faction);
    case "update_faction": {
      const patch: FactionPatch = sanitizeFactionPatch(operation.patch);
      return updateFaction(world, operation.factionId, patch);
    }
    case "remove_faction":
      return removeFaction(world, operation.factionId);
    default: {
      const exhaustive: never = operation;
      void exhaustive;
      return world;
    }
  }
}

function operationBatchKind(
  operation: MapOperation,
): "tile" | "territory" | "other" {
  switch (operation.type) {
    case "set_tiles":
      return "tile";
    case "set_faction_territories":
      return "territory";
    default:
      return "other";
  }
}

export function applyOperationsToWorld(
  world: MapState,
  operations: readonly MapOperation[],
): MapState {
  let nextWorld = world;
  let index = 0;

  while (index < operations.length) {
    const operation = operations[index];
    const batchKind = operationBatchKind(operation);

    if (batchKind === "tile") {
      const batch: TileMutation[] = [];

      while (
        index < operations.length &&
        operationBatchKind(operations[index]) === "tile"
      ) {
        const current = operations[index];

        switch (current.type) {
          case "set_tiles":
            for (const tile of current.tiles) {
              batch.push({
                q: tile.q,
                r: tile.r,
                terrain: tile.terrain,
                hidden: tile.hidden,
              });
            }
            break;
          default:
            break;
        }

        index += 1;
      }

      nextWorld = applySetTileOperationsToWorld(nextWorld, batch);
      continue;
    }

    if (batchKind === "territory") {
      const batch: TerritoryMutation[] = [];

      while (
        index < operations.length &&
        operationBatchKind(operations[index]) === "territory"
      ) {
        const current = operations[index];

        switch (current.type) {
          case "set_faction_territories":
            for (const territory of current.territories) {
              batch.push({
                q: territory.q,
                r: territory.r,
                factionId: territory.factionId,
              });
            }
            break;
          default:
            break;
        }

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
  applyMany: applyOperationsToWorld,
};

export const applyMapOperationToWorld = applyOperationToWorld;
