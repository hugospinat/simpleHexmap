import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  factionTerritories,
  factions,
  features,
  hexCells,
  mapTokens,
  workspaceMemberTokens,
  rivers,
  roads,
  maps,
} from "../db/schema.js";
import { defaultWorkspaceTokenColor } from "../../../src/core/auth/authTypes.js";
import type {
  MapFactionRecord,
  MapFactionTerritoryRecord,
  MapFeatureRecord,
  MapRiverRecord,
  MapRoadRecord,
  MapTileRecord,
  MapTokenRecord,
  SavedMapContent,
} from "../../../src/core/protocol/index.js";

type DbLike = any;

export const emptySavedMapContent: SavedMapContent = {
  version: 1,
  tiles: [],
  features: [],
  rivers: [],
  roads: [],
  factions: [],
  factionTerritories: [],
  tokens: [],
};

function asBoolean(value: number): boolean {
  return value === 1;
}

function boolInt(value: boolean): number {
  return value ? 1 : 0;
}

const INSERT_BATCH_SIZE = 500;
const ID_SCOPE_SEPARATOR = "::";

export function toMapScopedId(mapId: string, id: string): string {
  const prefix = `${mapId}${ID_SCOPE_SEPARATOR}`;
  return id.startsWith(prefix) ? id : `${prefix}${id}`;
}

export function fromMapScopedId(mapId: string, id: string): string {
  const prefix = `${mapId}${ID_SCOPE_SEPARATOR}`;
  return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

async function insertInBatches<T>(
  rows: T[],
  insertBatch: (batch: T[]) => Promise<void>,
): Promise<void> {
  for (let index = 0; index < rows.length; index += INSERT_BATCH_SIZE) {
    await insertBatch(rows.slice(index, index + INSERT_BATCH_SIZE));
  }
}

export async function materializeMapContent(
  mapId: string,
  database: DbLike = db,
): Promise<SavedMapContent> {
  const tileRows = await database
    .select()
    .from(hexCells)
    .where(eq(hexCells.mapId, mapId));
  const featureRows = await database
    .select()
    .from(features)
    .where(eq(features.mapId, mapId));
  const riverRows = await database
    .select()
    .from(rivers)
    .where(eq(rivers.mapId, mapId));
  const roadRows = await database
    .select()
    .from(roads)
    .where(eq(roads.mapId, mapId));
  const factionRows = await database
    .select()
    .from(factions)
    .where(eq(factions.mapId, mapId));
  const factionTerritoryRows = await database
    .select()
    .from(factionTerritories)
    .where(eq(factionTerritories.mapId, mapId));
  const tokenRows = await database
    .select()
    .from(mapTokens)
    .where(eq(mapTokens.mapId, mapId));
  const mapRows = await database
    .select({ workspaceId: maps.workspaceId })
    .from(maps)
    .where(eq(maps.id, mapId))
    .limit(1);
  const workspaceId = mapRows[0]?.workspaceId ?? null;
  const tokenUserIds: string[] = Array.from(
    new Set(
      (tokenRows as Array<{ userId: string }>).map((token) => token.userId),
    ),
  );
  const memberTokenRows =
    workspaceId && tokenUserIds.length > 0
      ? await database
          .select({
            color: workspaceMemberTokens.color,
            userId: workspaceMemberTokens.userId,
          })
          .from(workspaceMemberTokens)
          .where(
            and(
              eq(workspaceMemberTokens.workspaceId, workspaceId),
              inArray(workspaceMemberTokens.userId, tokenUserIds),
            ),
          )
      : [];
  const colorByUserId = new Map<string, string>(
    (memberTokenRows as Array<{ color: string; userId: string }>).map((row) => [
      row.userId,
      row.color,
    ]),
  );

  return {
    version: 1,
    tiles: tileRows.map(
      (tile): MapTileRecord => ({
        hidden: asBoolean(tile.hidden),
        q: tile.q,
        r: tile.r,
        terrain: tile.terrain,
      }),
    ),
    features: featureRows.map(
      (feature): MapFeatureRecord => ({
        gmLabel: feature.gmLabel,
        id: fromMapScopedId(mapId, feature.id),
        kind: feature.kind,
        labelRevealed: asBoolean(feature.labelRevealed),
        overrideTerrainTile: asBoolean(feature.overrideTerrainTile),
        playerLabel: feature.playerLabel,
        q: feature.q,
        r: feature.r,
        visibility: feature.visibility === "hidden" ? "hidden" : "visible",
      }),
    ),
    rivers: riverRows.map(
      (river): MapRiverRecord => ({
        edge: river.edge as MapRiverRecord["edge"],
        q: river.q,
        r: river.r,
      }),
    ),
    roads: roadRows.map(
      (road): MapRoadRecord => ({
        edges: road.edges as MapRoadRecord["edges"],
        q: road.q,
        r: road.r,
      }),
    ),
    factions: factionRows.map(
      (faction): MapFactionRecord => ({
        color: faction.color,
        id: fromMapScopedId(mapId, faction.id),
        name: faction.name,
      }),
    ),
    factionTerritories: factionTerritoryRows.map(
      (territory): MapFactionTerritoryRecord => ({
        factionId: fromMapScopedId(mapId, territory.factionId),
        q: territory.q,
        r: territory.r,
      }),
    ),
    tokens: tokenRows.map(
      (token): MapTokenRecord => ({
        color: colorByUserId.get(token.userId) ?? defaultWorkspaceTokenColor,
        profileId: token.userId,
        q: token.q,
        r: token.r,
      }),
    ),
  };
}

export async function replaceMapContent(
  mapId: string,
  content: SavedMapContent,
  database: DbLike = db,
): Promise<void> {
  const now = new Date();

  await database
    .delete(factionTerritories)
    .where(eq(factionTerritories.mapId, mapId));
  await database.delete(mapTokens).where(eq(mapTokens.mapId, mapId));
  await database.delete(rivers).where(eq(rivers.mapId, mapId));
  await database.delete(roads).where(eq(roads.mapId, mapId));
  await database.delete(features).where(eq(features.mapId, mapId));
  await database.delete(factions).where(eq(factions.mapId, mapId));
  await database.delete(hexCells).where(eq(hexCells.mapId, mapId));

  if (content.tiles.length > 0) {
    const tileRows = content.tiles.map((tile) => ({
      hidden: boolInt(tile.hidden),
      q: tile.q,
      r: tile.r,
      terrain: tile.terrain,
      updatedAt: now,
      mapId,
    }));
    await insertInBatches(tileRows, async (batch) => {
      await database.insert(hexCells).values(batch);
    });
  }

  if (content.features.length > 0) {
    const featureRows = content.features.map((feature) => ({
      createdAt: now,
      gmLabel: feature.gmLabel,
      id: toMapScopedId(mapId, feature.id),
      kind: feature.kind,
      labelRevealed: boolInt(feature.labelRevealed),
      overrideTerrainTile: boolInt(feature.overrideTerrainTile),
      playerLabel: feature.playerLabel,
      q: feature.q,
      r: feature.r,
      updatedAt: now,
      visibility: feature.visibility,
      mapId,
    }));
    await insertInBatches(featureRows, async (batch) => {
      await database.insert(features).values(batch);
    });
  }

  if (content.rivers.length > 0) {
    const riverRows = content.rivers.map((river) => ({
      edge: river.edge,
      q: river.q,
      r: river.r,
      mapId,
    }));
    await insertInBatches(riverRows, async (batch) => {
      await database.insert(rivers).values(batch);
    });
  }

  if (content.roads.length > 0) {
    const roadRows = content.roads.map((road) => ({
      edges: road.edges,
      q: road.q,
      r: road.r,
      mapId,
    }));
    await insertInBatches(roadRows, async (batch) => {
      await database.insert(roads).values(batch);
    });
  }

  if (content.factions.length > 0) {
    const factionRows = content.factions.map((faction) => ({
      color: faction.color,
      id: toMapScopedId(mapId, faction.id),
      name: faction.name,
      mapId,
    }));
    await insertInBatches(factionRows, async (batch) => {
      await database.insert(factions).values(batch);
    });
  }

  if (content.factionTerritories.length > 0) {
    const territoryRows = content.factionTerritories.map((territory) => ({
      factionId: toMapScopedId(mapId, territory.factionId),
      q: territory.q,
      r: territory.r,
      mapId,
    }));
    await insertInBatches(territoryRows, async (batch) => {
      await database.insert(factionTerritories).values(batch);
    });
  }

  if (content.tokens.length > 0) {
    const tokenRows = content.tokens.map((token) => ({
      q: token.q,
      r: token.r,
      userId: token.profileId,
      mapId,
    }));
    await insertInBatches(tokenRows, async (batch) => {
      await database.insert(mapTokens).values(batch);
    });
  }
}
