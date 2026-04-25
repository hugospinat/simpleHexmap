import { describe, expect, test } from "vitest";
import { mapFileVersion, parseMapDocument } from "./savedMapCodec.js";

const baseValidInput = {
  version: mapFileVersion,
  tiles: [],
  features: [],
  rivers: [],
  roads: [],
  factions: [],
  factionTerritories: [],
};

describe("saved map codec", () => {
  test("accepts a fully-populated canonical document", () => {
    const parsed = parseMapDocument({
      ...baseValidInput,
      tiles: [{ q: 0, r: 0, terrain: "plain", hidden: false }],
      features: [
        {
          id: "feature-1",
          kind: "city",
          featureLevel: 2,
          q: 0,
          r: 0,
          hidden: false,
        },
      ],
    });

    expect(parsed.tiles).toEqual([
      { q: 0, r: 0, terrain: "plain", hidden: false },
    ]);
    expect(parsed.features[0].kind).toBe("city");
  });

  test("rejects payload missing required arrays", () => {
    expect(() => parseMapDocument({ version: mapFileVersion })).toThrow(
      "Map file is missing required arrays.",
    );
  });

  test("rejects payload missing the roads array", () => {
    const { roads: _roads, ...withoutRoads } = baseValidInput;
    expect(() => parseMapDocument(withoutRoads)).toThrow(
      "Map file is missing required arrays.",
    );
  });

  test("rejects legacy tileId tiles (requires canonical terrain)", () => {
    expect(() =>
      parseMapDocument({
        ...baseValidInput,
        tiles: [{ q: 0, r: 0, tileId: "plain", hidden: false }],
      }),
    ).toThrow("Invalid tile entry");
  });

  test("rejects tiles missing the boolean hidden flag", () => {
    expect(() =>
      parseMapDocument({
        ...baseValidInput,
        tiles: [{ q: 0, r: 0, terrain: "plain" }],
      }),
    ).toThrow("Invalid tile entry");
  });

  test("rejects legacy feature.type (requires canonical kind)", () => {
    expect(() =>
      parseMapDocument({
        ...baseValidInput,
        features: [
          {
            id: "feature-1",
            type: "city",
            q: 0,
            r: 0,
            hidden: false,
          },
        ],
      }),
    ).toThrow("Invalid feature entry");
  });

  test("rejects features without a stable id", () => {
    expect(() =>
      parseMapDocument({
        ...baseValidInput,
        features: [
          {
            kind: "city",
            featureLevel: 2,
            q: 0,
            r: 0,
            hidden: false,
          },
        ],
      }),
    ).toThrow("Invalid feature entry");
  });

  test("rejects invalid faction colors", () => {
    expect(() =>
      parseMapDocument({
        ...baseValidInput,
        factions: [{ id: "f-1", name: "Faction", color: "blue" }],
      }),
    ).toThrow("Invalid faction color");
  });
});
