import type { Axial } from "@/core/geometry/hex";
import { SOURCE_LEVEL } from "@/core/map/mapRules";
import {
  addRoadConnection,
  getRoadEdgeBetween,
  removeRoadConnectionsAt,
  type MapState
} from "@/core/map/world";
import { emptyCommandResult, type MapEditCommandResult } from "./commandTypes";

export function commandAddRoadConnection(world: MapState, level: number, from: Axial, to: Axial): MapEditCommandResult {
  if (level !== SOURCE_LEVEL || getRoadEdgeBetween(from, to) === null) {
    return emptyCommandResult(world);
  }

  const nextWorld = addRoadConnection(world, level, from, to);

  if (nextWorld === world) {
    return emptyCommandResult(world);
  }

  return {
    changed: true,
    mapState: nextWorld,
    operations: [{ type: "add_road_connection", from, to }]
  };
}

export function commandRemoveRoadConnectionsAt(world: MapState, level: number, axial: Axial): MapEditCommandResult {
  if (level !== SOURCE_LEVEL) {
    return emptyCommandResult(world);
  }

  const nextWorld = removeRoadConnectionsAt(world, level, axial);

  if (nextWorld === world) {
    return emptyCommandResult(world);
  }

  return {
    changed: true,
    mapState: nextWorld,
    operations: [{ type: "remove_road_connections_at", cell: axial }]
  };
}
