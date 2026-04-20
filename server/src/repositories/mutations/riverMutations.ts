import { and, eq } from "drizzle-orm";
import { rivers } from "../../db/schema.js";
import type { DbLike, IncrementalOperationHandler } from "./mutationHelpers.js";

export const addRiverData: IncrementalOperationHandler<
  "add_river_data"
> = async (tx, mapId, operation) => {
  await tx
    .insert(rivers)
    .values({
      edge: operation.river.edge,
      q: operation.river.q,
      r: operation.river.r,
      mapId,
    })
    .onConflictDoNothing();
};

export const removeRiverData: IncrementalOperationHandler<
  "remove_river_data"
> = async (tx, mapId, operation) => {
  await tx
    .delete(rivers)
    .where(
      and(
        eq(rivers.mapId, mapId),
        eq(rivers.q, operation.river.q),
        eq(rivers.r, operation.river.r),
        eq(rivers.edge, operation.river.edge),
      ),
    );
};
