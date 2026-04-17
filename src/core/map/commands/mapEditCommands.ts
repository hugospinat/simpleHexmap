import { getNeighbors, type Axial } from "@/core/geometry/hex";
import type { MapState } from "@/core/map/world";
import {
  emptyCommandResult,
  type MapEditCommand,
  type MapEditCommandEffects,
  type MapEditCommandResult
} from "./commandTypes";
import {
  commandEraseTerrain,
  commandPaintTerrain,
  commandSetCellHidden
} from "./terrainCommands";
import {
  commandAddFeature,
  commandRemoveFeature,
  commandSetFeatureHidden,
  commandToggleFeatureHiddenAt,
  commandUpdateFeature
} from "./featureCommands";
import {
  commandAddFaction,
  commandAssignFaction,
  commandClearFaction,
  commandRemoveFaction,
  commandUpdateFaction
} from "./factionCommands";
import {
  commandAddRoadConnection,
  commandRemoveRoadConnectionsAt
} from "./roadCommands";
import { commandSetRiverEdge } from "./riverCommands";

export type {
  MapEditCommand,
  MapEditCommandEffects,
  MapEditCommandResult
} from "./commandTypes";
export {
  commandEraseTerrain,
  commandPaintTerrain,
  commandSetCellHidden
} from "./terrainCommands";
export {
  commandAddFeature,
  commandRemoveFeature,
  commandSetFeatureHidden,
  commandToggleFeatureHiddenAt,
  commandUpdateFeature
} from "./featureCommands";
export {
  commandAddFaction,
  commandAssignFaction,
  commandClearFaction,
  commandRemoveFaction,
  commandUpdateFaction
} from "./factionCommands";
export {
  commandAddRoadConnection,
  commandRemoveRoadConnectionsAt
} from "./roadCommands";
export { commandSetRiverEdge } from "./riverCommands";

export function executeMapEditCommand(world: MapState, command: MapEditCommand): MapEditCommandResult {
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
      return emptyCommandResult(world);
    }
  }
}

export function getAdjacentAxials(axial: Axial): Axial[] {
  return getNeighbors(axial);
}
