import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  factionTerritories,
  factions,
  features,
  hexCells,
  mapTokens,
  rivers,
  roads,
} from "../db/schema.js";
import type {
  MapDocument,
  MapFactionRecord,
  MapFactionTerritoryRecord,
  MapFeatureRecord,
  MapRiverRecord,
  MapRoadRecord,
  MapTileRecord,
  MapTokenPlacement,
} from "../../../src/core/protocol/index.js";
import { mapFileVersion } from "../../../src/core/document/savedMapCodec.js";

type DbLike = any;

const INSERT_BATCH_SIZE = 500;

export const emptyMapDocument: MapDocument = {
  version: mapFileVersion,
  tiles: [],
  features: [],
  rivers: [],
  roads: [],
  factions: [],
  factionTerritories: [],
};

async function insertInBatches<T>(
  rows: T[],
  insertBatch: (batch: T[]) => Promise<void>,
): Promise<void> {
  for (let index = 0; index < rows.length; index += INSERT_BATCH_SIZE) {
    await insertBatch(rows.slice(index, index + INSERT_BATCH_SIZE));
  }
}

export async function materializeMapDocument(
  mapId: string,
  database: DbLike = db,
): Promise<MapDocument> {
  const [
    tileRows,
    featureRows,
    riverRows,
    roadRows,
    factionRows,
    territoryRows,
  ] = await Promise.all([
    database.select().from(hexCells).where(eq(hexCells.mapId, mapId)),
    database.select().from(features).where(eq(features.mapId, mapId)),
    database.select().from(rivers).where(eq(rivers.mapId, mapId)),
    database.select().from(roads).where(eq(roads.mapId, mapId)),
    database.select().from(factions).where(eq(factions.mapId, mapId)),
    database
      .select()
      .from(factionTerritories)
      .where(eq(factionTerritories.mapId, mapId)),
  ]);

  return {
    version: mapFileVersion,
    tiles: tileRows.map(
      (tile): MapTileRecord => ({
        hidden: tile.hidden,
        q: tile.q,
        r: tile.r,
        terrain: tile.terrain,
      }),
    ),
    features: featureRows.map(
      (feature): MapFeatureRecord => ({
        featureLevel: feature.featureLevel as MapFeatureRecord["featureLevel"],
        hidden: feature.hidden,
        id: feature.id,
        kind: feature.kind,
        q: feature.q,
        r: feature.r,
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
        id: faction.id,
        name: faction.name,
      }),
    ),
    factionTerritories: territoryRows.map(
      (territory): MapFactionTerritoryRecord => ({
        factionId: territory.factionId,
        q: territory.q,
        r: territory.r,
      }),
    ),
  };
}

export async function materializeTokenPlacements(
  mapId: string,
  database: DbLike = db,
): Promise<MapTokenPlacement[]> {
  const tokenRows = await database
    .select()
    .from(mapTokens)
    .where(eq(mapTokens.mapId, mapId));

  return tokenRows.map(
    (token): MapTokenPlacement => ({
      userId: token.userId,
      q: token.q,
      r: token.r,
    }),
  );
}

export async function replaceMapDocument(
  mapId: string,
  document: MapDocument,
  database: DbLike = db,
): Promise<void> {
  const now = new Date();

  await database
    .delete(factionTerritories)
    .where(eq(factionTerritories.mapId, mapId));
  await database.delete(rivers).where(eq(rivers.mapId, mapId));
  await database.delete(roads).where(eq(roads.mapId, mapId));
  await database.delete(features).where(eq(features.mapId, mapId));
  await database.delete(factions).where(eq(factions.mapId, mapId));
  await database.delete(hexCells).where(eq(hexCells.mapId, mapId));

  if (document.tiles.length > 0) {
    await insertInBatches(
      document.tiles.map((tile) => ({
        hidden: tile.hidden,
        mapId,
        q: tile.q,
        r: tile.r,
        terrain: tile.terrain,
        updatedAt: now,
      })),
      async (batch) => {
        await database.insert(hexCells).values(batch);
      },
    );
  }

  if (document.features.length > 0) {
    await insertInBatches(
      document.features.map((feature) => ({
        createdAt: now,
        featureLevel: feature.featureLevel,
        hidden: feature.hidden,
        id: feature.id,
        kind: feature.kind,
        mapId,
        q: feature.q,
        r: feature.r,
        updatedAt: now,
      })),
      async (batch) => {
        await database.insert(features).values(batch);
      },
    );
  }

  if (document.rivers.length > 0) {
    await insertInBatches(
      document.rivers.map((river) => ({
        edge: river.edge,
        mapId,
        q: river.q,
        r: river.r,
      })),
      async (batch) => {
        await database.insert(rivers).values(batch);
      },
    );
  }

  if (document.roads.length > 0) {
    await insertInBatches(
      document.roads.map((road) => ({
        edges: road.edges,
        mapId,
        q: road.q,
        r: road.r,
      })),
      async (batch) => {
        await database.insert(roads).values(batch);
      },
    );
  }

  if (document.factions.length > 0) {
    await insertInBatches(
      document.factions.map((faction) => ({
        color: faction.color,
        id: faction.id,
        mapId,
        name: faction.name,
      })),
      async (batch) => {
        await database.insert(factions).values(batch);
      },
    );
  }

  if (document.factionTerritories.length > 0) {
    await insertInBatches(
      document.factionTerritories.map((territory) => ({
        factionId: territory.factionId,
        mapId,
        q: territory.q,
        r: territory.r,
      })),
      async (batch) => {
        await database.insert(factionTerritories).values(batch);
      },
    );
  }
}
