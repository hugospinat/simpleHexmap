import { describe, expect, it } from "vitest";
import {
  applyMapTokenOperations,
  validateMapTokenOperation,
  type SavedMapContent
} from "./index";

function createContent(tokens: SavedMapContent["tokens"] = []): SavedMapContent {
  return {
    version: 1,
    tiles: [],
    features: [],
    rivers: [],
    roads: [],
    factions: [],
    factionTerritories: [],
    tokens
  };
}

describe("token operations", () => {
  it("sets, moves, recolors, and removes one token per profile", () => {
    const content = applyMapTokenOperations(createContent(), [
      {
        type: "set_map_token",
        token: { profileId: "p1", q: 1, r: 2, color: "#112233" }
      },
      {
        type: "set_map_token",
        token: { profileId: "p1", q: 3, r: 4, color: "#445566" }
      },
      {
        type: "set_map_token",
        token: { profileId: "p2", q: 1, r: 2, color: "#778899" }
      }
    ]);

    expect(content.tokens).toEqual([
      { profileId: "p1", q: 3, r: 4, color: "#445566" },
      { profileId: "p2", q: 1, r: 2, color: "#778899" }
    ]);

    expect(applyMapTokenOperations(content, [{ type: "remove_map_token", profileId: "p1" }]).tokens).toEqual([
      { profileId: "p2", q: 1, r: 2, color: "#778899" }
    ]);
  });

  it("validates token payload shape", () => {
    expect(validateMapTokenOperation({
      type: "set_map_token",
      token: { profileId: "p1", q: 0, r: 0, color: "#abcdef" }
    })).toBeNull();
    expect(validateMapTokenOperation({
      type: "set_map_token",
      token: { profileId: "p1", q: 0, r: 0, color: "red" }
    })).toBe("Invalid set_map_token operation.");
    expect(validateMapTokenOperation({
      type: "remove_map_token",
      profileId: ""
    })).toBe("Invalid remove_map_token operation.");
  });
});
