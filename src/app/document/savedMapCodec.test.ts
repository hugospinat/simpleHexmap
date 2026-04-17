import { describe, expect, test } from "vitest";
import {
  addFaction,
  addFeature,
  addRoadConnection,
  addRiverEdge,
  addTile,
  assignFactionAt,
  createEmptyWorld,
  type MapState
} from "@/core/map/world";
import { parseSavedMapContent } from "@/app/document/savedMapCodec";
import { deserializeWorld, serializeWorld } from "@/app/document/worldMapCodec";

function createSampleWorld(): MapState {
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

describe("saved map codecs", () => {
  test("parseSavedMapContent validates required map arrays", () => {
    expect(() => parseSavedMapContent({ version: 1 })).toThrow("Map file is missing required arrays.");
  });

  test("parseSavedMapContent rejects invalid faction colors", () => {
    expect(() => parseSavedMapContent({
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

  test("parseSavedMapContent accepts legacy tileId records and normalizes to terrain", () => {
    const parsed = parseSavedMapContent({
      version: 1,
      tiles: [{ q: 0, r: 0, tileId: "plain" }],
      features: [],
      rivers: [],
      factions: [],
      factionTerritories: []
    });

    expect(parsed.tiles).toEqual([{ q: 0, r: 0, terrain: "plain", hidden: false }]);
  });

  test("parseSavedMapContent accepts legacy feature type records and normalizes to kind", () => {
    const parsed = parseSavedMapContent({
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
