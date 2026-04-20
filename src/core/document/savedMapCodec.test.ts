import { describe, expect, test } from "vitest";
import { parseSavedMapContent } from "./savedMapCodec.js";

const baseValidInput = {
  version: 1,
  tiles: [],
  features: [],
  rivers: [],
  roads: [],
  factions: [],
  factionTerritories: [],
  tokens: [],
};

describe("saved map codec", () => {
  test("accepts a fully-populated canonical document", () => {
    const parsed = parseSavedMapContent({
      ...baseValidInput,
      tiles: [{ q: 0, r: 0, terrain: "plain", hidden: false }],
      features: [
        {
          id: "feature-1",
          kind: "city",
          q: 0,
          r: 0,
          visibility: "visible",
          overrideTerrainTile: false,
          gmLabel: null,
          playerLabel: null,
          labelRevealed: false,
        },
      ],
    });

    expect(parsed.tiles).toEqual([
      { q: 0, r: 0, terrain: "plain", hidden: false },
    ]);
    expect(parsed.features[0].kind).toBe("city");
  });

  test("rejects payload missing required arrays", () => {
    expect(() => parseSavedMapContent({ version: 1 })).toThrow(
      "Map file is missing required arrays.",
    );
  });

  test("rejects payload missing the tokens array", () => {
    const { tokens: _tokens, ...withoutTokens } = baseValidInput;
    expect(() => parseSavedMapContent(withoutTokens)).toThrow(
      "Map file is missing required arrays.",
    );
  });

  test("rejects payload missing the roads array", () => {
    const { roads: _roads, ...withoutRoads } = baseValidInput;
    expect(() => parseSavedMapContent(withoutRoads)).toThrow(
      "Map file is missing required arrays.",
    );
  });

  test("rejects legacy tileId tiles (requires canonical terrain)", () => {
    expect(() =>
      parseSavedMapContent({
        ...baseValidInput,
        tiles: [{ q: 0, r: 0, tileId: "plain", hidden: false }],
      }),
    ).toThrow("Invalid tile entry");
  });

  test("rejects tiles missing the boolean hidden flag", () => {
    expect(() =>
      parseSavedMapContent({
        ...baseValidInput,
        tiles: [{ q: 0, r: 0, terrain: "plain" }],
      }),
    ).toThrow("Invalid tile entry");
  });

  test("rejects legacy feature.type (requires canonical kind)", () => {
    expect(() =>
      parseSavedMapContent({
        ...baseValidInput,
        features: [
          {
            id: "feature-1",
            type: "city",
            q: 0,
            r: 0,
            visibility: "visible",
            overrideTerrainTile: false,
            gmLabel: null,
            playerLabel: null,
            labelRevealed: false,
          },
        ],
      }),
    ).toThrow("Invalid feature entry");
  });

  test("rejects features without a stable id", () => {
    expect(() =>
      parseSavedMapContent({
        ...baseValidInput,
        features: [
          {
            kind: "city",
            q: 0,
            r: 0,
            visibility: "visible",
            overrideTerrainTile: false,
            gmLabel: null,
            playerLabel: null,
            labelRevealed: false,
          },
        ],
      }),
    ).toThrow("Invalid feature entry");
  });

  test("rejects invalid faction colors", () => {
    expect(() =>
      parseSavedMapContent({
        ...baseValidInput,
        factions: [{ id: "f-1", name: "Faction", color: "blue" }],
      }),
    ).toThrow("Invalid faction color");
  });
});
