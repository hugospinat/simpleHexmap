import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  factionTerritories,
  factions,
  features,
  hexCells,
  mapTokens,
  rivers,
  roads
} from "../db/schema.js";
import type {
  MapFactionRecord,
  MapFactionTerritoryRecord,
  MapFeatureRecord,
  MapRiverRecord,
  MapRoadRecord,
  MapTileRecord,
  MapTokenRecord,
  SavedMapContent
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
  tokens: []
};

function asBoolean(value: number): boolean {
  return value === 1;
}

function boolInt(value: boolean): number {
  return value ? 1 : 0;
}

const INSERT_BATCH_SIZE = 500;
const ID_SCOPE_SEPARATOR = "::";

function toWorkspaceScopedId(workspaceId: string, id: string): string {
  const prefix = `${workspaceId}${ID_SCOPE_SEPARATOR}`;
  return id.startsWith(prefix) ? id : `${prefix}${id}`;
}

function fromWorkspaceScopedId(workspaceId: string, id: string): string {
  const prefix = `${workspaceId}${ID_SCOPE_SEPARATOR}`;
  return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

async function insertInBatches<T>(
  rows: T[],
  insertBatch: (batch: T[]) => Promise<void>
): Promise<void> {
  for (let index = 0; index < rows.length; index += INSERT_BATCH_SIZE) {
    await insertBatch(rows.slice(index, index + INSERT_BATCH_SIZE));
  }
}

export async function materializeWorkspaceContent(workspaceId: string, database: DbLike = db): Promise<SavedMapContent> {
  const tileRows = await database.select().from(hexCells).where(eq(hexCells.workspaceId, workspaceId));
  const featureRows = await database.select().from(features).where(eq(features.workspaceId, workspaceId));
  const riverRows = await database.select().from(rivers).where(eq(rivers.workspaceId, workspaceId));
  const roadRows = await database.select().from(roads).where(eq(roads.workspaceId, workspaceId));
  const factionRows = await database.select().from(factions).where(eq(factions.workspaceId, workspaceId));
  const factionTerritoryRows = await database.select().from(factionTerritories).where(eq(factionTerritories.workspaceId, workspaceId));
  const tokenRows = await database.select().from(mapTokens).where(eq(mapTokens.workspaceId, workspaceId));

  return {
    version: 1,
    tiles: tileRows.map((tile): MapTileRecord => ({
      hidden: asBoolean(tile.hidden),
      q: tile.q,
      r: tile.r,
      terrain: tile.terrain
    })),
    features: featureRows.map((feature): MapFeatureRecord => ({
      gmLabel: feature.gmLabel,
      id: fromWorkspaceScopedId(workspaceId, feature.id),
      kind: feature.kind,
      labelRevealed: asBoolean(feature.labelRevealed),
      overrideTerrainTile: asBoolean(feature.overrideTerrainTile),
      playerLabel: feature.playerLabel,
      q: feature.q,
      r: feature.r,
      visibility: feature.visibility === "hidden" ? "hidden" : "visible"
    })),
    rivers: riverRows.map((river): MapRiverRecord => ({
      edge: river.edge as MapRiverRecord["edge"],
      q: river.q,
      r: river.r
    })),
    roads: roadRows.map((road): MapRoadRecord => ({
      edges: road.edges as MapRoadRecord["edges"],
      q: road.q,
      r: road.r
    })),
    factions: factionRows.map((faction): MapFactionRecord => ({
      color: faction.color,
      id: fromWorkspaceScopedId(workspaceId, faction.id),
      name: faction.name
    })),
    factionTerritories: factionTerritoryRows.map((territory): MapFactionTerritoryRecord => ({
      factionId: fromWorkspaceScopedId(workspaceId, territory.factionId),
      q: territory.q,
      r: territory.r
    })),
    tokens: tokenRows.map((token): MapTokenRecord => ({
      color: token.color,
      profileId: token.userId,
      q: token.q,
      r: token.r
    }))
  };
}

export async function replaceWorkspaceContent(
  workspaceId: string,
  content: SavedMapContent,
  database: DbLike = db
): Promise<void> {
  const now = new Date();

  await database.delete(factionTerritories).where(eq(factionTerritories.workspaceId, workspaceId));
  await database.delete(mapTokens).where(eq(mapTokens.workspaceId, workspaceId));
  await database.delete(rivers).where(eq(rivers.workspaceId, workspaceId));
  await database.delete(roads).where(eq(roads.workspaceId, workspaceId));
  await database.delete(features).where(eq(features.workspaceId, workspaceId));
  await database.delete(factions).where(eq(factions.workspaceId, workspaceId));
  await database.delete(hexCells).where(eq(hexCells.workspaceId, workspaceId));

  if (content.tiles.length > 0) {
    const tileRows = content.tiles.map((tile) => ({
      hidden: boolInt(tile.hidden),
      q: tile.q,
      r: tile.r,
      terrain: tile.terrain,
      updatedAt: now,
      workspaceId
    }));
    await insertInBatches(tileRows, async (batch) => {
      await database.insert(hexCells).values(batch);
    });
  }

  if (content.features.length > 0) {
    const featureRows = content.features.map((feature) => ({
      createdAt: now,
      gmLabel: feature.gmLabel,
      id: toWorkspaceScopedId(workspaceId, feature.id),
      kind: feature.kind,
      labelRevealed: boolInt(feature.labelRevealed),
      overrideTerrainTile: boolInt(feature.overrideTerrainTile),
      playerLabel: feature.playerLabel,
      q: feature.q,
      r: feature.r,
      updatedAt: now,
      visibility: feature.visibility,
      workspaceId
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
      workspaceId
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
      workspaceId
    }));
    await insertInBatches(roadRows, async (batch) => {
      await database.insert(roads).values(batch);
    });
  }

  if (content.factions.length > 0) {
    const factionRows = content.factions.map((faction) => ({
      color: faction.color,
      id: toWorkspaceScopedId(workspaceId, faction.id),
      name: faction.name,
      workspaceId
    }));
    await insertInBatches(factionRows, async (batch) => {
      await database.insert(factions).values(batch);
    });
  }

  if (content.factionTerritories.length > 0) {
    const territoryRows = content.factionTerritories.map((territory) => ({
      factionId: toWorkspaceScopedId(workspaceId, territory.factionId),
      q: territory.q,
      r: territory.r,
      workspaceId
    }));
    await insertInBatches(territoryRows, async (batch) => {
      await database.insert(factionTerritories).values(batch);
    });
  }

  if (content.tokens.length > 0) {
    const tokenRows = content.tokens.map((token) => ({
      color: token.color,
      q: token.q,
      r: token.r,
      userId: token.profileId,
      workspaceId
    }));
    await insertInBatches(tokenRows, async (batch) => {
      await database.insert(mapTokens).values(batch);
    });
  }
}
