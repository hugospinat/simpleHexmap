import { and, eq, or } from "drizzle-orm";
import { hexCells } from "../../db/schema.js";
import { deleteFactionTerritoriesForCells } from "./factionMutations.js";
import {
  boolInt,
  chunkValues,
  mutationChunkSize,
  uniqueCells,
  type Axial,
  type DbLike,
  type IncrementalOperationHandler,
} from "./mutationHelpers.js";

async function deleteHexCellsForCells(
  tx: DbLike,
  mapId: string,
  cells: readonly Axial[],
): Promise<void> {
  for (const chunk of chunkValues(uniqueCells([...cells]), mutationChunkSize)) {
    const where = and(
      eq(hexCells.mapId, mapId),
      chunk.length === 1
        ? and(eq(hexCells.q, chunk[0].q), eq(hexCells.r, chunk[0].r))
        : or(
            ...chunk.map((cell) =>
              and(eq(hexCells.q, cell.q), eq(hexCells.r, cell.r)),
            ),
          ),
    );

    await tx.delete(hexCells).where(where);
  }
}

async function upsertHexCells(
  tx: DbLike,
  mapId: string,
  tiles: Array<{ q: number; r: number; terrain: string; hidden: boolean }>,
  updatedAt: Date,
): Promise<void> {
  if (tiles.length === 0) {
    return;
  }

  await deleteHexCellsForCells(
    tx,
    mapId,
    tiles.map((tile) => ({ q: tile.q, r: tile.r })),
  );

  for (const chunk of chunkValues(tiles, mutationChunkSize)) {
    await tx.insert(hexCells).values(
      chunk.map((tile) => ({
        hidden: boolInt(tile.hidden),
        q: tile.q,
        r: tile.r,
        terrain: tile.terrain,
        updatedAt,
        mapId,
      })),
    );
  }
}

async function updateHiddenForCells(
  tx: DbLike,
  mapId: string,
  cells: readonly Axial[],
  hidden: boolean,
  updatedAt: Date,
): Promise<void> {
  for (const chunk of chunkValues(uniqueCells([...cells]), mutationChunkSize)) {
    const where = and(
      eq(hexCells.mapId, mapId),
      chunk.length === 1
        ? and(eq(hexCells.q, chunk[0].q), eq(hexCells.r, chunk[0].r))
        : or(
            ...chunk.map((cell) =>
              and(eq(hexCells.q, cell.q), eq(hexCells.r, cell.r)),
            ),
          ),
    );

    await tx
      .update(hexCells)
      .set({
        hidden: boolInt(hidden),
        updatedAt,
      })
      .where(where);
  }
}

export const paintCells: IncrementalOperationHandler<"paint_cells"> = async (
  tx,
  mapId,
  operation,
  updatedAt,
) => {
  const cells = uniqueCells(operation.cells);

  if (operation.terrain === null) {
    await deleteHexCellsForCells(tx, mapId, cells);
    await deleteFactionTerritoriesForCells(tx, mapId, cells);
    return;
  }

  await upsertHexCells(
    tx,
    mapId,
    cells.map((cell) => ({
      q: cell.q,
      r: cell.r,
      terrain: operation.terrain,
      hidden: operation.hidden,
    })),
    updatedAt,
  );
};

export const setCellsHidden: IncrementalOperationHandler<
  "set_cells_hidden"
> = async (tx, mapId, operation, updatedAt) => {
  await updateHiddenForCells(
    tx,
    mapId,
    operation.cells,
    operation.hidden,
    updatedAt,
  );
};

export const setTiles: IncrementalOperationHandler<"set_tiles"> = async (
  tx,
  mapId,
  operation,
  updatedAt,
) => {
  const deletions: Axial[] = [];
  const upserts: Array<{
    q: number;
    r: number;
    terrain: string;
    hidden: boolean;
  }> = [];

  for (const tile of operation.tiles) {
    if (tile.terrain === null) {
      deletions.push({ q: tile.q, r: tile.r });
    } else {
      upserts.push({
        q: tile.q,
        r: tile.r,
        terrain: tile.terrain,
        hidden: tile.hidden,
      });
    }
  }

  if (deletions.length > 0) {
    await deleteHexCellsForCells(tx, mapId, deletions);
    await deleteFactionTerritoriesForCells(tx, mapId, deletions);
  }

  await upsertHexCells(tx, mapId, upserts, updatedAt);
};
