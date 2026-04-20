import { and, eq } from "drizzle-orm";
import { roads } from "../../db/schema.js";
import { normalizeRoad } from "../../../../src/core/protocol/index.js";
import type { DbLike, IncrementalOperationHandler } from "./mutationHelpers.js";

export const setRoadEdges: IncrementalOperationHandler<
  "set_road_edges"
> = async (tx, mapId, operation) => {
  const { cell, edges } = operation;

  if (edges.length === 0) {
    await tx
      .delete(roads)
      .where(
        and(eq(roads.mapId, mapId), eq(roads.q, cell.q), eq(roads.r, cell.r)),
      );
    return;
  }

  const road = normalizeRoad({ q: cell.q, r: cell.r, edges });

  await tx
    .insert(roads)
    .values({
      edges: road.edges,
      q: road.q,
      r: road.r,
      mapId,
    })
    .onConflictDoUpdate({
      target: [roads.mapId, roads.q, roads.r],
      set: {
        edges: road.edges,
      },
    });
};
