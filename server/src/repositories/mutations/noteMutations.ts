import { and, eq, or } from "drizzle-orm";
import { mapNotes } from "../../db/schema.js";
import {
  chunkValues,
  mutationChunkSize,
  uniqueCells,
  type Axial,
  type DbLike,
  type IncrementalOperationHandler,
} from "./mutationHelpers.js";

export async function deleteMapNotesForCells(
  tx: DbLike,
  mapId: string,
  cells: readonly Axial[],
): Promise<void> {
  for (const chunk of chunkValues(uniqueCells([...cells]), mutationChunkSize)) {
    const where = and(
      eq(mapNotes.mapId, mapId),
      chunk.length === 1
        ? and(eq(mapNotes.q, chunk[0].q), eq(mapNotes.r, chunk[0].r))
        : or(
            ...chunk.map((cell) =>
              and(eq(mapNotes.q, cell.q), eq(mapNotes.r, cell.r)),
            ),
          ),
    );

    await tx.delete(mapNotes).where(where);
  }
}

export const setNote: IncrementalOperationHandler<"set_note"> = async (
  tx,
  mapId,
  operation,
  updatedAt,
) => {
  await deleteMapNotesForCells(tx, mapId, [operation.note]);

  if (operation.note.markdown === null) {
    return;
  }

  await tx.insert(mapNotes).values({
    markdown: operation.note.markdown,
    mapId,
    q: operation.note.q,
    r: operation.note.r,
    updatedAt,
  });
};
