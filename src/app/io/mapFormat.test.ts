import { describe, expect, test } from "vitest";
import {
  addFaction,
  addFeature,
  addRoadConnection,
  addRiverEdge,
  addTile,
  assignFactionAt,
  createEmptyWorld,
  type World
} from "@/domain/world/world";
import { deserializeWorld, parseSavedMap, serializeWorld } from "@/app/io/mapFormat";

function createSampleWorld(): World {
  let world = createEmptyWorld();

  world = addTile(world, 3, { q: 0, r: 0 }, "plain");
  world = addTile(world, 3, { q: 1, r: 0 }, "forest");
  world = addFaction(world, { id: "f-1", name: "North", color: "#123456" });
  world = assignFactionAt(world, 3, { q: 0, r: 0 }, "f-1");
  world = addFeature(world, 3, {
    id: "feature-1",
    kind: "city",
    hexId: "0,0",
    hidden: false,
    overrideTerrainTile: true,
    labelRevealed: true,
    gmLabel: "GM",
    playerLabel: "City"
  });
  world = addRiverEdge(world, 3, {
    axial: { q: 0, r: 0 },
    edge: 1
  });
  world = addRoadConnection(world, 3, { q: 0, r: 0 }, { q: 1, r: 0 });

  return world;
}

describe("mapFormat", () => {
  test("parseSavedMap validates required map arrays", () => {
    expect(() => parseSavedMap({ version: 1 })).toThrow("Map file is missing required arrays.");
  });

  test("parseSavedMap rejects invalid faction colors", () => {
    expect(() => parseSavedMap({
      version: 1,
      tiles: [],
      features: [],
      rivers: [],
      factions: [{ id: "f-1", name: "Faction", color: "blue" }],
      factionTerritories: []
    })).toThrow("Invalid faction color");
  });

  test("serializing and deserializing preserves saved map shape", () => {
    const world = createSampleWorld();
    const serialized = serializeWorld(world);
    const loadedWorld = deserializeWorld(serialized);
    const reserialized = serializeWorld(loadedWorld);

    expect(reserialized).toEqual(serialized);
  });

  test("parseSavedMap accepts legacy tileId records and normalizes to terrain", () => {
    const parsed = parseSavedMap({
      version: 1,
      tiles: [{ q: 0, r: 0, tileId: "plain" }],
      features: [],
      rivers: [],
      factions: [],
      factionTerritories: []
    });

    expect(parsed.tiles).toEqual([{ q: 0, r: 0, terrain: "plain", hidden: false }]);
  });

  test("parseSavedMap accepts legacy feature type records and normalizes to kind", () => {
    const parsed = parseSavedMap({
      version: 1,
      tiles: [],
      features: [{
        id: "feature-1",
        type: "city",
        q: 0,
        r: 0,
        visibility: "visible",
        overrideTerrainTile: false,
        gmLabel: null,
        playerLabel: null,
        labelRevealed: false
      }],
      rivers: [],
      factions: [],
      factionTerritories: []
    });

    expect(parsed.features[0].kind).toBe("city");
  });
});
