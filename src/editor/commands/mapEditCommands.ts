import { getDescendantsAtLevel, getNeighbors, hexKey, parseHexKey, type Axial } from "@/domain/geometry/hex";
import {
  addRoadConnection,
  getFactionById,
  getFactionLevelMap,
  getFeatureAt,
  getFeatureById,
  getNeighborForRoadEdge,
  getRoadEdgeBetween,
  getRoadLevelMap,
  getRiverLevelMap,
  removeRoadConnectionsAt,
  type Faction,
  type Feature,
  type RiverEdgeRef,
  type RoadEdgeIndex,
  type TerrainType,
  type World
} from "@/domain/world/world";
import { SOURCE_LEVEL } from "@/domain/world/mapRules";
import { getCanonicalRiverEdgeRef } from "@/domain/world/rivers";
import { applyOperationToWorld, applyOperationsToWorld } from "@/domain/world/worldOperationApplier";
import type { MapOperation } from "@/shared/mapProtocol";

export type MapEditCommandResult = {
  effects?: MapCommandEffects;
  operations: MapOperation[];
  world: World;
};

export type MapCommandEffects = {
  selectedFeatureId?: string | null;
};

export type MapCommand =
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

function emptyResult(world: World): MapEditCommandResult {
  return { operations: [], world };
}

export function executeMapCommand(world: World, command: MapCommand): MapEditCommandResult {
  switch (command.type) {
    case "paintTerrain":
      return commandPaintTerrain(world, command.level, command.axial, command.terrainType);
    case "eraseTerrain":
      return commandEraseTerrain(world, command.level, command.axial);
    case "setCellHidden":
      return commandSetCellHidden(world, command.level, command.axial, command.hidden);
    case "addFeature":
      return commandAddFeature(world, command.level, command.feature);
    case "updateFeature":
      return commandUpdateFeature(world, command.level, command.featureId, command.updates);
    case "setFeatureHidden":
      return commandSetFeatureHidden(world, command.featureId, command.hidden);
    case "removeFeature":
      return commandRemoveFeature(world, command.featureId);
    case "assignFaction":
      return commandAssignFaction(world, command.level, command.axial, command.factionId);
    case "clearFaction":
      return commandClearFaction(world, command.level, command.axial);
    case "addFaction":
      return commandAddFaction(world, command.faction);
    case "updateFaction":
      return commandUpdateFaction(world, command.factionId, command.patch);
    case "removeFaction":
      return commandRemoveFaction(world, command.factionId);
    case "addRoadConnection":
      return commandAddRoadConnection(world, command.level, command.from, command.to);
    case "removeRoadConnectionsAt":
      return commandRemoveRoadConnectionsAt(world, command.level, command.axial);
    case "setRiverEdge":
      return commandSetRiverEdge(world, command.level, command.ref, command.enabled);
    case "toggleFeatureHiddenAt":
      return commandToggleFeatureHiddenAt(world, command.level, command.axial);
    default: {
      const exhaustive: never = command;
      void exhaustive;
      return emptyResult(world);
    }
  }
}

function terrainTargets(level: number, axial: Axial): Axial[] {
  return getDescendantsAtLevel(axial, level, SOURCE_LEVEL);
}

export function commandPaintTerrain(
  world: World,
  level: number,
  axial: Axial,
  terrainType: TerrainType
): MapEditCommandResult {
  const sourceMap = world.levels[SOURCE_LEVEL] ?? new Map();
  const operations: MapOperation[] = [];

  for (const target of terrainTargets(level, axial)) {
    const current = sourceMap.get(hexKey(target));

    if (current?.type === terrainType) {
      continue;
    }

    operations.push({
      type: "set_tile",
      tile: {
        q: target.q,
        r: target.r,
        terrain: terrainType,
        hidden: current?.hidden ?? false
      }
    });
  }

  return operations.length > 0
    ? { operations, world: applyOperationsToWorld(world, operations) }
    : emptyResult(world);
}

export function commandEraseTerrain(world: World, level: number, axial: Axial): MapEditCommandResult {
  const sourceMap = world.levels[SOURCE_LEVEL] ?? new Map();
  const operations: MapOperation[] = [];

  for (const target of terrainTargets(level, axial)) {
    if (!sourceMap.has(hexKey(target))) {
      continue;
    }

    operations.push({
      type: "set_tile",
      tile: {
        q: target.q,
        r: target.r,
        terrain: null,
        hidden: false
      }
    });
  }

  return operations.length > 0
    ? { operations, world: applyOperationsToWorld(world, operations) }
    : emptyResult(world);
}

export function commandSetCellHidden(
  world: World,
  level: number,
  axial: Axial,
  hidden: boolean
): MapEditCommandResult {
  const sourceMap = world.levels[SOURCE_LEVEL] ?? new Map();
  const operations: MapOperation[] = [];

  for (const target of terrainTargets(level, axial)) {
    const current = sourceMap.get(hexKey(target));

    if (!current || current.hidden === hidden) {
      continue;
    }

    operations.push({
      type: "set_cell_hidden",
      cell: {
        q: target.q,
        r: target.r,
        hidden
      }
    });
  }

  return operations.length > 0
    ? { operations, world: applyOperationsToWorld(world, operations) }
    : emptyResult(world);
}

function featureToRecord(feature: Feature): Extract<MapOperation, { type: "add_feature" }>["feature"] {
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

export function commandAddFeature(world: World, level: number, feature: Feature): MapEditCommandResult {
  if (
    level !== SOURCE_LEVEL
    || getFeatureById(world, SOURCE_LEVEL, feature.id)
    || getFeatureAt(world, SOURCE_LEVEL, parseHexKey(feature.hexId))
  ) {
    return emptyResult(world);
  }

  const operation: MapOperation = {
    type: "add_feature",
    feature: featureToRecord(feature)
  };

  return {
    operations: [operation],
    world: applyOperationToWorld(world, operation)
  };
}

export function commandUpdateFeature(
  world: World,
  level: number,
  featureId: string,
  updates: Partial<Pick<Feature, "gmLabel" | "hidden" | "kind" | "labelRevealed" | "overrideTerrainTile" | "playerLabel">>
): MapEditCommandResult {
  const patch: Extract<MapOperation, { type: "update_feature" }>["patch"] = {};

  if (level === SOURCE_LEVEL && typeof updates.kind === "string") {
    patch.kind = updates.kind;
  }
  if (typeof updates.hidden === "boolean") {
    patch.visibility = updates.hidden ? "hidden" : "visible";
  }
  if (typeof updates.overrideTerrainTile === "boolean") {
    patch.overrideTerrainTile = updates.overrideTerrainTile;
  }
  if ("gmLabel" in updates) {
    patch.gmLabel = updates.gmLabel?.trim() ? updates.gmLabel : null;
  }
  if ("playerLabel" in updates) {
    patch.playerLabel = updates.playerLabel?.trim() ? updates.playerLabel : null;
  }
  if (typeof updates.labelRevealed === "boolean") {
    patch.labelRevealed = updates.labelRevealed;
  }

  if (Object.keys(patch).length === 0) {
    return emptyResult(world);
  }

  const operation: MapOperation = {
    type: "update_feature",
    featureId,
    patch
  };
  const nextWorld = applyOperationToWorld(world, operation);

  return nextWorld !== world ? { operations: [operation], world: nextWorld } : emptyResult(world);
}

export function commandSetFeatureHidden(world: World, featureId: string, hidden: boolean): MapEditCommandResult {
  const operation: MapOperation = {
    type: "set_feature_hidden",
    featureId,
    hidden
  };
  const nextWorld = applyOperationToWorld(world, operation);

  return nextWorld !== world ? { operations: [operation], world: nextWorld } : emptyResult(world);
}

export function commandRemoveFeature(world: World, featureId: string): MapEditCommandResult {
  if (!getFeatureById(world, SOURCE_LEVEL, featureId)) {
    return emptyResult(world);
  }

  const operation: MapOperation = {
    type: "remove_feature",
    featureId
  };

  return {
    operations: [operation],
    world: applyOperationToWorld(world, operation)
  };
}

function factionTerritoryOperations(
  world: World,
  level: number,
  axial: Axial,
  factionId: string | null
): MapOperation[] {
  if (factionId && !getFactionById(world, factionId)) {
    return [];
  }

  const sourceMap = world.levels[SOURCE_LEVEL] ?? new Map();
  const assignments = getFactionLevelMap(world, SOURCE_LEVEL);
  const operations: MapOperation[] = [];

  for (const target of terrainTargets(level, axial)) {
    const key = hexKey(target);

    if (!sourceMap.has(key)) {
      continue;
    }

    if ((assignments.get(key) ?? null) === factionId) {
      continue;
    }

    operations.push({
      type: "set_faction_territory",
      territory: {
        q: target.q,
        r: target.r,
        factionId
      }
    });
  }

  return operations;
}

export function commandAssignFaction(
  world: World,
  level: number,
  axial: Axial,
  factionId: string
): MapEditCommandResult {
  const operations = factionTerritoryOperations(world, level, axial, factionId);
  return operations.length > 0
    ? { operations, world: applyOperationsToWorld(world, operations) }
    : emptyResult(world);
}

export function commandClearFaction(world: World, level: number, axial: Axial): MapEditCommandResult {
  const operations = factionTerritoryOperations(world, level, axial, null);
  return operations.length > 0
    ? { operations, world: applyOperationsToWorld(world, operations) }
    : emptyResult(world);
}

export function commandAddFaction(world: World, faction: Faction): MapEditCommandResult {
  const operation: MapOperation = { type: "add_faction", faction };
  const nextWorld = applyOperationToWorld(world, operation);

  return nextWorld !== world ? { operations: [operation], world: nextWorld } : emptyResult(world);
}

export function commandUpdateFaction(
  world: World,
  factionId: string,
  patch: Partial<Pick<Faction, "color" | "name">>
): MapEditCommandResult {
  const operation: MapOperation = { type: "update_faction", factionId, patch };
  const nextWorld = applyOperationToWorld(world, operation);

  return nextWorld !== world ? { operations: [operation], world: nextWorld } : emptyResult(world);
}

export function commandRemoveFaction(world: World, factionId: string): MapEditCommandResult {
  const operation: MapOperation = { type: "remove_faction", factionId };
  const nextWorld = applyOperationToWorld(world, operation);

  return nextWorld !== world ? { operations: [operation], world: nextWorld } : emptyResult(world);
}

export function commandAddRoadConnection(world: World, level: number, from: Axial, to: Axial): MapEditCommandResult {
  if (level !== SOURCE_LEVEL || getRoadEdgeBetween(from, to) === null) {
    return emptyResult(world);
  }

  const nextWorld = addRoadConnection(world, level, from, to);

  if (nextWorld === world) {
    return emptyResult(world);
  }

  return {
    operations: [{ type: "add_road_connection", from, to }],
    world: nextWorld
  };
}

export function commandRemoveRoadConnectionsAt(world: World, level: number, axial: Axial): MapEditCommandResult {
  if (level !== SOURCE_LEVEL) {
    return emptyResult(world);
  }

  const nextWorld = removeRoadConnectionsAt(world, level, axial);

  if (nextWorld === world) {
    return emptyResult(world);
  }

  return {
    operations: [{ type: "remove_road_connections_at", cell: axial }],
    world: nextWorld
  };
}

function hasRiverEdge(world: World, ref: RiverEdgeRef): boolean {
  return getRiverLevelMap(world, SOURCE_LEVEL).get(hexKey(ref.axial))?.has(ref.edge) ?? false;
}

export function commandSetRiverEdge(
  world: World,
  level: number,
  ref: RiverEdgeRef,
  enabled: boolean
): MapEditCommandResult {
  if (level !== SOURCE_LEVEL) {
    return emptyResult(world);
  }

  const canonical = getCanonicalRiverEdgeRef(ref);

  if (hasRiverEdge(world, canonical) === enabled) {
    return emptyResult(world);
  }

  const operation: MapOperation = enabled
    ? {
      type: "add_river_data",
      river: {
        q: canonical.axial.q,
        r: canonical.axial.r,
        edge: canonical.edge
      }
    }
    : {
      type: "remove_river_data",
      river: {
        q: canonical.axial.q,
        r: canonical.axial.r,
        edge: canonical.edge
      }
    };

  return {
    operations: [operation],
    world: applyOperationToWorld(world, operation)
  };
}

export function commandToggleFeatureHiddenAt(world: World, level: number, axial: Axial): MapEditCommandResult {
  const feature = getFeatureAt(world, level, axial);

  if (!feature) {
    return emptyResult(world);
  }

  return commandSetFeatureHidden(world, feature.id, !feature.hidden);
}

export function getAdjacentAxials(axial: Axial): Axial[] {
  return getNeighbors(axial);
}
