import { describe, expect, test } from "vitest";
import { parseSavedMapContent } from "./savedMapCodec.js";

describe("saved map codec", () => {
  test("validates required map arrays", () => {
    expect(() => parseSavedMapContent({ version: 1 })).toThrow("Map file is missing required arrays.");
  });

  test("rejects invalid faction colors", () => {
    expect(() => parseSavedMapContent({
      version: 1,
      tiles: [],
      features: [],
      rivers: [],
      factions: [{ id: "f-1", name: "Faction", color: "blue" }],
      factionTerritories: [],
      tokens: []
    })).toThrow("Invalid faction color");
  });

  test("accepts legacy tileId records and normalizes to terrain", () => {
    const parsed = parseSavedMapContent({
      version: 1,
      tiles: [{ q: 0, r: 0, tileId: "plain" }],
      features: [],
      rivers: [],
      factions: [],
      factionTerritories: [],
      tokens: []
    });

    expect(parsed.tiles).toEqual([{ q: 0, r: 0, terrain: "plain", hidden: false }]);
  });

  test("accepts legacy feature type records and normalizes to kind", () => {
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
      factionTerritories: [],
      tokens: []
    });

    expect(parsed.features[0].kind).toBe("city");
  });
});
