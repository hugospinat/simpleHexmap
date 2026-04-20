import { and, eq, or } from "drizzle-orm";
import { factionTerritories, factions } from "../../db/schema.js";
import { toMapScopedId } from "../mapContentRepository.js";
import { sanitizeFactionPatch } from "../../../../src/core/protocol/index.js";
import {
  chunkValues,
  mutationChunkSize,
  uniqueCells,
  type Axial,
  type DbLike,
  type IncrementalOperationHandler,
} from "./mutationHelpers.js";

export async function deleteFactionTerritoriesForCells(
  tx: DbLike,
  mapId: string,
  cells: readonly Axial[],
): Promise<void> {
  for (const chunk of chunkValues(uniqueCells([...cells]), mutationChunkSize)) {
    const where = and(
      eq(factionTerritories.mapId, mapId),
      chunk.length === 1
        ? and(
            eq(factionTerritories.q, chunk[0].q),
            eq(factionTerritories.r, chunk[0].r),
          )
        : or(
            ...chunk.map((cell) =>
              and(
                eq(factionTerritories.q, cell.q),
                eq(factionTerritories.r, cell.r),
              ),
            ),
          ),
    );

    await tx.delete(factionTerritories).where(where);
  }
}

async function upsertFactionTerritories(
  tx: DbLike,
  mapId: string,
  territories: Array<{ q: number; r: number; factionId: string }>,
): Promise<void> {
  if (territories.length === 0) {
    return;
  }

  await deleteFactionTerritoriesForCells(
    tx,
    mapId,
    territories.map((territory) => ({ q: territory.q, r: territory.r })),
  );

  for (const chunk of chunkValues(territories, mutationChunkSize)) {
    await tx.insert(factionTerritories).values(
      chunk.map((territory) => ({
        factionId: toMapScopedId(mapId, territory.factionId),
        q: territory.q,
        r: territory.r,
        mapId,
      })),
    );
  }
}

export const assignFactionCells: IncrementalOperationHandler<
  "assign_faction_cells"
> = async (tx, mapId, operation) => {
  const cells = uniqueCells(operation.cells);
  await deleteFactionTerritoriesForCells(tx, mapId, cells);

  if (operation.factionId === null) {
    return;
  }

  await upsertFactionTerritories(
    tx,
    mapId,
    cells.map((cell) => ({
      q: cell.q,
      r: cell.r,
      factionId: operation.factionId,
    })),
  );
};

export const setFactionTerritories: IncrementalOperationHandler<
  "set_faction_territories"
> = async (tx, mapId, operation) => {
  const cells = operation.territories.map((territory) => ({
    q: territory.q,
    r: territory.r,
  }));
  await deleteFactionTerritoriesForCells(tx, mapId, cells);

  const nonNullTerritories = operation.territories
    .filter((territory) => territory.factionId !== null)
    .map((territory) => ({
      q: territory.q,
      r: territory.r,
      factionId: territory.factionId as string,
    }));

  await upsertFactionTerritories(tx, mapId, nonNullTerritories);
};

export const addFaction: IncrementalOperationHandler<"add_faction"> = async (
  tx,
  mapId,
  operation,
) => {
  await tx
    .insert(factions)
    .values({
      color: operation.faction.color,
      id: toMapScopedId(mapId, operation.faction.id),
      name: operation.faction.name,
      mapId,
    })
    .onConflictDoNothing();
};

export const updateFaction: IncrementalOperationHandler<
  "update_faction"
> = async (tx, mapId, operation) => {
  const patch = sanitizeFactionPatch(operation.patch);
  const set: Record<string, unknown> = {};

  if ("name" in patch && typeof patch.name === "string") {
    set.name = patch.name;
  }
  if ("color" in patch && typeof patch.color === "string") {
    set.color = patch.color;
  }

  if (Object.keys(set).length === 0) {
    return;
  }

  await tx
    .update(factions)
    .set(set)
    .where(eq(factions.id, toMapScopedId(mapId, operation.factionId)));
};

export const removeFaction: IncrementalOperationHandler<
  "remove_faction"
> = async (tx, mapId, operation) => {
  await tx
    .delete(factions)
    .where(eq(factions.id, toMapScopedId(mapId, operation.factionId)));
};
