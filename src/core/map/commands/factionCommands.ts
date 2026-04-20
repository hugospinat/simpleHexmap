import { hexKey, type Axial } from "@/core/geometry/hex";
import { SOURCE_LEVEL } from "@/core/map/mapRules";
import {
  applyOperationToWorld,
  applyOperationsToWorld,
} from "@/core/map/worldOperationApplier";
import {
  getFactionById,
  getFactionLevelMap,
  type Faction,
  type MapState,
} from "@/core/map/world";
import type { MapOperation } from "@/core/protocol";
import { emptyCommandResult, type MapEditCommandResult } from "./commandTypes";
import { terrainTargets } from "./terrainCommands";

function factionTerritoryOperations(
  world: MapState,
  level: number,
  axial: Axial,
  factionId: string | null,
): MapOperation[] {
  if (factionId && !getFactionById(world, factionId)) {
    return [];
  }

  const sourceMap = world.levels[SOURCE_LEVEL] ?? new Map();
  const assignments = getFactionLevelMap(world, SOURCE_LEVEL);
  const territories: Array<{ q: number; r: number; factionId: string | null }> =
    [];

  for (const target of terrainTargets(level, axial)) {
    const key = hexKey(target);

    if (!sourceMap.has(key)) {
      continue;
    }

    if ((assignments.get(key) ?? null) === factionId) {
      continue;
    }

    territories.push({ q: target.q, r: target.r, factionId });
  }

  if (territories.length === 0) {
    return [];
  }

  return [
    {
      type: "set_faction_territories",
      territories,
    },
  ];
}

export function commandAssignFaction(
  world: MapState,
  level: number,
  axial: Axial,
  factionId: string,
): MapEditCommandResult {
  const operations = factionTerritoryOperations(world, level, axial, factionId);
  return operations.length > 0
    ? {
        changed: true,
        mapState: applyOperationsToWorld(world, operations),
        operations,
      }
    : emptyCommandResult(world);
}

export function commandClearFaction(
  world: MapState,
  level: number,
  axial: Axial,
): MapEditCommandResult {
  const operations = factionTerritoryOperations(world, level, axial, null);
  return operations.length > 0
    ? {
        changed: true,
        mapState: applyOperationsToWorld(world, operations),
        operations,
      }
    : emptyCommandResult(world);
}

export function commandAddFaction(
  world: MapState,
  faction: Faction,
): MapEditCommandResult {
  const operation: MapOperation = { type: "add_faction", faction };
  const nextWorld = applyOperationToWorld(world, operation);

  return nextWorld !== world
    ? { changed: true, mapState: nextWorld, operations: [operation] }
    : emptyCommandResult(world);
}

export function commandUpdateFaction(
  world: MapState,
  factionId: string,
  patch: Partial<Pick<Faction, "color" | "name">>,
): MapEditCommandResult {
  const operation: MapOperation = { type: "update_faction", factionId, patch };
  const nextWorld = applyOperationToWorld(world, operation);

  return nextWorld !== world
    ? { changed: true, mapState: nextWorld, operations: [operation] }
    : emptyCommandResult(world);
}

export function commandRemoveFaction(
  world: MapState,
  factionId: string,
): MapEditCommandResult {
  const operation: MapOperation = { type: "remove_faction", factionId };
  const nextWorld = applyOperationToWorld(world, operation);

  return nextWorld !== world
    ? { changed: true, mapState: nextWorld, operations: [operation] }
    : emptyCommandResult(world);
}
