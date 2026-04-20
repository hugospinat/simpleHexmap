import type { Axial } from "@/core/geometry/hex";
import { SOURCE_LEVEL } from "@/core/map/mapRules";
import {
  addRoadConnection,
  getRoadEdgeBetween,
  getRoadEdgesAt,
  removeRoadConnectionsAt,
  getNeighborForRoadEdge,
  getOppositeRoadEdgeIndex,
  type MapState,
  type RoadEdgeIndex,
} from "@/core/map/world";
import { emptyCommandResult, type MapEditCommandResult } from "./commandTypes";
import type {
  MapOperation,
  RoadEdgeIndex as ProtoRoadEdgeIndex,
} from "@/core/protocol";

function roadEdgesOperation(
  cell: Axial,
  edges: Set<RoadEdgeIndex>,
): Extract<MapOperation, { type: "set_road_edges" }> {
  return {
    type: "set_road_edges",
    cell: { q: cell.q, r: cell.r },
    edges: Array.from(edges).sort((a, b) => a - b) as ProtoRoadEdgeIndex[],
  };
}

export function commandAddRoadConnection(
  world: MapState,
  level: number,
  from: Axial,
  to: Axial,
): MapEditCommandResult {
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
    operations: [
      roadEdgesOperation(from, getRoadEdgesAt(nextWorld, level, from)),
      roadEdgesOperation(to, getRoadEdgesAt(nextWorld, level, to)),
    ],
  };
}

export function commandRemoveRoadConnectionsAt(
  world: MapState,
  level: number,
  axial: Axial,
): MapEditCommandResult {
  if (level !== SOURCE_LEVEL) {
    return emptyCommandResult(world);
  }

  const edgesBefore = getRoadEdgesAt(world, level, axial);

  if (edgesBefore.size === 0) {
    return emptyCommandResult(world);
  }

  const nextWorld = removeRoadConnectionsAt(world, level, axial);

  const operations: MapOperation[] = [roadEdgesOperation(axial, new Set())];

  for (const edge of edgesBefore) {
    const neighbor = getNeighborForRoadEdge(axial, edge);
    operations.push(
      roadEdgesOperation(neighbor, getRoadEdgesAt(nextWorld, level, neighbor)),
    );
  }

  return {
    changed: true,
    mapState: nextWorld,
    operations,
  };
}
