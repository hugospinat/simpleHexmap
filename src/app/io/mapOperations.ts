import { deserializeWorld, serializeWorld, type MapFactionRecord, type MapFeatureRecord, type MapRiverRecord, type MapRoadRecord, type MapTileRecord, type SavedMap } from "@/app/io/mapFormat";
import type { World } from "@/domain/world/world";

type TileKey = `${number},${number}`;
type RiverKey = `${number},${number},${number}`;
type FeaturePatch = Partial<Pick<MapFeatureRecord, "gmLabel" | "labelRevealed" | "overrideTerrainTile" | "playerLabel" | "type" | "visibility">>;
type FactionPatch = Partial<Pick<MapFactionRecord, "color" | "name">>;

export type MapOperation =
  | { type: "set_tile"; tile: Omit<MapTileRecord, "tileId"> & { tileId: string | null } }
  | { type: "set_cell_hidden"; cell: { q: number; r: number; hidden: boolean } }
  | { type: "add_feature"; feature: MapFeatureRecord }
  | { type: "set_feature_hidden"; featureId: string; hidden: boolean }
  | { type: "update_feature"; featureId: string; patch: FeaturePatch }
  | { type: "remove_feature"; featureId: string }
  | { type: "add_river_data"; river: MapRiverRecord }
  | { type: "update_river_data"; from: MapRiverRecord; to: MapRiverRecord }
  | { type: "remove_river_data"; river: MapRiverRecord }
  | { type: "add_road_data"; road: MapRoadRecord }
  | { type: "update_road_data"; road: MapRoadRecord }
  | { type: "remove_road_data"; road: Pick<MapRoadRecord, "q" | "r"> }
  | { type: "add_faction"; faction: MapFactionRecord }
  | { type: "update_faction"; factionId: string; patch: FactionPatch }
  | { type: "remove_faction"; factionId: string }
  | { type: "set_faction_territory"; territory: { q: number; r: number; factionId: string | null } }
  | { type: "rename_map"; name: string };

function tileKey(tile: Pick<MapTileRecord, "q" | "r">): TileKey {
  return `${tile.q},${tile.r}`;
}

function riverKey(river: MapRiverRecord): RiverKey {
  return `${river.q},${river.r},${river.edge}`;
}

function roadKey(road: Pick<MapRoadRecord, "q" | "r">): TileKey {
  return `${road.q},${road.r}`;
}

function normalizeRoad(road: MapRoadRecord): MapRoadRecord {
  return {
    q: road.q,
    r: road.r,
    edges: Array.from(new Set(road.edges)).sort((left, right) => left - right)
  };
}

function removeFactionTerritory(territories: SavedMap["factionTerritories"], q: number, r: number): SavedMap["factionTerritories"] {
  return territories.filter((territory) => territory.q !== q || territory.r !== r);
}

function sanitizeFeaturePatch(patch: FeaturePatch): FeaturePatch {
  const next: FeaturePatch = {};

  if (typeof patch.type === "string") {
    next.type = patch.type;
  }
  if (patch.visibility === "visible" || patch.visibility === "hidden") {
    next.visibility = patch.visibility;
  }
  if (typeof patch.overrideTerrainTile === "boolean") {
    next.overrideTerrainTile = patch.overrideTerrainTile;
  }
  if (typeof patch.gmLabel === "string" || patch.gmLabel === null) {
    next.gmLabel = patch.gmLabel;
  }
  if (typeof patch.playerLabel === "string" || patch.playerLabel === null) {
    next.playerLabel = patch.playerLabel;
  }
  if (typeof patch.labelRevealed === "boolean") {
    next.labelRevealed = patch.labelRevealed;
  }

  return next;
}

function sanitizeFactionPatch(patch: FactionPatch): FactionPatch {
  const next: FactionPatch = {};

  if (typeof patch.name === "string" && patch.name.trim()) {
    next.name = patch.name.trim();
  }
  if (typeof patch.color === "string") {
    next.color = patch.color;
  }

  return next;
}

export function applyMapOperation(snapshot: SavedMap, operation: MapOperation): SavedMap {
  switch (operation.type) {
    case "set_tile": {
      const key = tileKey(operation.tile);
      const filteredTiles = snapshot.tiles.filter((tile) => tileKey(tile) !== key);

      if (operation.tile.tileId === null) {
        return {
          ...snapshot,
          tiles: filteredTiles,
          factionTerritories: removeFactionTerritory(snapshot.factionTerritories, operation.tile.q, operation.tile.r)
        };
      }

      const tile: MapTileRecord = {
        hidden: operation.tile.hidden ?? false,
        q: operation.tile.q,
        r: operation.tile.r,
        tileId: operation.tile.tileId
      };

      return {
        ...snapshot,
        tiles: [...filteredTiles, tile]
      };
    }
    case "set_cell_hidden": {
      let changed = false;
      const tiles = snapshot.tiles.map((tile) => {
        if (tile.q !== operation.cell.q || tile.r !== operation.cell.r || tile.hidden === operation.cell.hidden) {
          return tile;
        }

        changed = true;
        return {
          ...tile,
          hidden: operation.cell.hidden
        };
      });

      return changed ? { ...snapshot, tiles } : snapshot;
    }
    case "add_feature": {
      if (snapshot.features.some((feature) => feature.id === operation.feature.id)) {
        return snapshot;
      }

      return {
        ...snapshot,
        features: [...snapshot.features, operation.feature]
      };
    }
    case "set_feature_hidden": {
      const visibility: "hidden" | "visible" = operation.hidden ? "hidden" : "visible";
      let changed = false;
      const features = snapshot.features.map((feature) => {
        if (feature.id !== operation.featureId || feature.visibility === visibility) {
          return feature;
        }

        changed = true;
        return {
          ...feature,
          visibility
        };
      });

      return changed ? { ...snapshot, features } : snapshot;
    }
    case "update_feature": {
      const patch = sanitizeFeaturePatch(operation.patch);
      let changed = false;
      const features = snapshot.features.map((feature) => {
        if (feature.id !== operation.featureId) {
          return feature;
        }

        changed = true;
        return {
          ...feature,
          ...patch
        };
      });

      return changed ? { ...snapshot, features } : snapshot;
    }
    case "remove_feature":
      return {
        ...snapshot,
        features: snapshot.features.filter((feature) => feature.id !== operation.featureId)
      };
    case "add_river_data": {
      const key = riverKey(operation.river);

      if (snapshot.rivers.some((river) => riverKey(river) === key)) {
        return snapshot;
      }

      return {
        ...snapshot,
        rivers: [...snapshot.rivers, operation.river]
      };
    }
    case "update_river_data": {
      const fromKey = riverKey(operation.from);
      const rivers = snapshot.rivers.filter((river) => riverKey(river) !== fromKey);

      if (!rivers.some((river) => riverKey(river) === riverKey(operation.to))) {
        rivers.push(operation.to);
      }

      return {
        ...snapshot,
        rivers
      };
    }
    case "remove_river_data":
      return {
        ...snapshot,
        rivers: snapshot.rivers.filter((river) => riverKey(river) !== riverKey(operation.river))
      };
    case "add_road_data":
    case "update_road_data": {
      const normalized = normalizeRoad(operation.road);
      const roads = snapshot.roads.filter((road) => roadKey(road) !== roadKey(normalized));
      roads.push(normalized);

      return {
        ...snapshot,
        roads
      };
    }
    case "remove_road_data":
      return {
        ...snapshot,
        roads: snapshot.roads.filter((road) => roadKey(road) !== roadKey(operation.road))
      };
    case "add_faction": {
      if (snapshot.factions.some((faction) => faction.id === operation.faction.id)) {
        return snapshot;
      }

      return {
        ...snapshot,
        factions: [...snapshot.factions, operation.faction]
      };
    }
    case "update_faction": {
      const patch = sanitizeFactionPatch(operation.patch);
      let changed = false;
      const factions = snapshot.factions.map((faction) => {
        if (faction.id !== operation.factionId) {
          return faction;
        }

        changed = true;
        return {
          ...faction,
          ...patch
        };
      });

      return changed ? { ...snapshot, factions } : snapshot;
    }
    case "remove_faction":
      return {
        ...snapshot,
        factions: snapshot.factions.filter((faction) => faction.id !== operation.factionId),
        factionTerritories: snapshot.factionTerritories.filter((territory) => territory.factionId !== operation.factionId)
      };
    case "set_faction_territory": {
      const { q, r, factionId } = operation.territory;
      const factionTerritories = removeFactionTerritory(snapshot.factionTerritories, q, r);

      if (factionId) {
        factionTerritories.push({ q, r, factionId });
      }

      return {
        ...snapshot,
        factionTerritories
      };
    }
    case "rename_map":
      return snapshot;
    default: {
      const exhaustive: never = operation;
      void exhaustive;
      return snapshot;
    }
  }
}

export function applyMapOperations(snapshot: SavedMap, operations: MapOperation[]): SavedMap {
  return operations.reduce(applyMapOperation, snapshot);
}

function mapByKey<T>(items: T[], key: (item: T) => string): Map<string, T> {
  return new Map(items.map((item) => [key(item), item]));
}

function equalRoadEdges(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

export function diffWorldAsOperations(previousWorld: World, nextWorld: World): MapOperation[] {
  const previous = serializeWorld(previousWorld);
  const next = serializeWorld(nextWorld);
  const operations: MapOperation[] = [];
  const previousTiles = mapByKey(previous.tiles, tileKey);
  const nextTiles = mapByKey(next.tiles, tileKey);

  for (const [key, tile] of nextTiles.entries()) {
    const current = previousTiles.get(key);

    if (!current || current.tileId !== tile.tileId) {
      operations.push({ type: "set_tile", tile });
      continue;
    }

    if (current.hidden !== tile.hidden) {
      operations.push({
        type: "set_cell_hidden",
        cell: {
          q: tile.q,
          r: tile.r,
          hidden: tile.hidden
        }
      });
    }
  }

  for (const tile of previous.tiles) {
    if (!nextTiles.has(tileKey(tile))) {
      operations.push({
        type: "set_tile",
        tile: {
          hidden: false,
          q: tile.q,
          r: tile.r,
          tileId: null
        }
      });
    }
  }

  const previousFeatures = mapByKey(previous.features, (feature) => feature.id);
  const nextFeatures = mapByKey(next.features, (feature) => feature.id);

  for (const [id, feature] of nextFeatures.entries()) {
    const current = previousFeatures.get(id);

    if (!current) {
      operations.push({ type: "add_feature", feature });
      continue;
    }

    const patch: FeaturePatch = {};
    let hasPatch = false;

    if (current.type !== feature.type) {
      patch.type = feature.type;
      hasPatch = true;
    }
    if (current.visibility !== feature.visibility) {
      operations.push({
        type: "set_feature_hidden",
        featureId: id,
        hidden: feature.visibility === "hidden"
      });
    }
    if (current.overrideTerrainTile !== feature.overrideTerrainTile) {
      patch.overrideTerrainTile = feature.overrideTerrainTile;
      hasPatch = true;
    }
    if (current.gmLabel !== feature.gmLabel) {
      patch.gmLabel = feature.gmLabel;
      hasPatch = true;
    }
    if (current.playerLabel !== feature.playerLabel) {
      patch.playerLabel = feature.playerLabel;
      hasPatch = true;
    }
    if (current.labelRevealed !== feature.labelRevealed) {
      patch.labelRevealed = feature.labelRevealed;
      hasPatch = true;
    }

    if (hasPatch) {
      operations.push({
        type: "update_feature",
        featureId: id,
        patch
      });
    }
  }

  for (const feature of previous.features) {
    if (!nextFeatures.has(feature.id)) {
      operations.push({
        type: "remove_feature",
        featureId: feature.id
      });
    }
  }

  const previousRivers = mapByKey(previous.rivers, riverKey);
  const nextRivers = mapByKey(next.rivers, riverKey);

  for (const [key, river] of nextRivers.entries()) {
    if (!previousRivers.has(key)) {
      operations.push({ type: "add_river_data", river });
    }
  }

  for (const [key, river] of previousRivers.entries()) {
    if (!nextRivers.has(key)) {
      operations.push({ type: "remove_river_data", river });
    }
  }

  const previousRoads = mapByKey(previous.roads.map(normalizeRoad), roadKey);
  const nextRoads = mapByKey(next.roads.map(normalizeRoad), roadKey);

  for (const [key, road] of nextRoads.entries()) {
    const current = previousRoads.get(key);

    if (!current) {
      operations.push({ type: "add_road_data", road });
      continue;
    }

    if (!equalRoadEdges(current.edges, road.edges)) {
      operations.push({ type: "update_road_data", road });
    }
  }

  for (const [key, road] of previousRoads.entries()) {
    if (!nextRoads.has(key)) {
      operations.push({
        type: "remove_road_data",
        road: {
          q: road.q,
          r: road.r
        }
      });
    }
  }

  const previousFactions = mapByKey(previous.factions, (faction) => faction.id);
  const nextFactions = mapByKey(next.factions, (faction) => faction.id);

  for (const [id, faction] of nextFactions.entries()) {
    const current = previousFactions.get(id);

    if (!current) {
      operations.push({ type: "add_faction", faction });
      continue;
    }

    const patch: FactionPatch = {};
    let hasPatch = false;

    if (current.name !== faction.name) {
      patch.name = faction.name;
      hasPatch = true;
    }

    if (current.color !== faction.color) {
      patch.color = faction.color;
      hasPatch = true;
    }

    if (hasPatch) {
      operations.push({
        type: "update_faction",
        factionId: id,
        patch
      });
    }
  }

  for (const faction of previous.factions) {
    if (!nextFactions.has(faction.id)) {
      operations.push({
        type: "remove_faction",
        factionId: faction.id
      });
    }
  }

  const previousTerritories = mapByKey(previous.factionTerritories, tileKey);
  const nextTerritories = mapByKey(next.factionTerritories, tileKey);

  for (const [key, territory] of nextTerritories.entries()) {
    const current = previousTerritories.get(key);

    if (!current || current.factionId !== territory.factionId) {
      operations.push({
        type: "set_faction_territory",
        territory
      });
    }
  }

  for (const territory of previous.factionTerritories) {
    if (!nextTerritories.has(tileKey(territory))) {
      operations.push({
        type: "set_faction_territory",
        territory: {
          q: territory.q,
          r: territory.r,
          factionId: null
        }
      });
    }
  }

  return operations;
}

export function applyMapOperationToWorld(world: World, operation: MapOperation): World {
  return deserializeWorld(applyMapOperation(serializeWorld(world), operation));
}
