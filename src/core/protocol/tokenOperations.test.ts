import { describe, expect, it } from "vitest";
import {
  applyMapTokenOperations,
  validateMapTokenOperation,
  type MapTokenPlacement,
} from "./index";

function createContent(tokens: MapTokenPlacement[] = []): MapTokenPlacement[] {
  return tokens;
}

describe("token operations", () => {
  it("sets, moves, recolors, and removes one token per user", () => {
    const content = applyMapTokenOperations(createContent(), [
      {
        type: "set_map_token",
        placement: { userId: "p1", q: 1, r: 2 },
      },
      {
        type: "set_map_token",
        placement: { userId: "p1", q: 3, r: 4 },
      },
      {
        type: "set_map_token",
        placement: { userId: "p2", q: 1, r: 2 },
      },
    ]);

    expect(content).toEqual([
      { userId: "p1", q: 3, r: 4 },
      { userId: "p2", q: 1, r: 2 },
    ]);

    expect(
      applyMapTokenOperations(content, [
        { type: "remove_map_token", userId: "p1" },
      ]),
    ).toEqual([{ userId: "p2", q: 1, r: 2 }]);
  });

  it("validates token payload shape", () => {
    expect(
      validateMapTokenOperation({
        type: "set_map_token",
        placement: { userId: "p1", q: 0, r: 0 },
      }),
    ).toBeNull();
    expect(
      validateMapTokenOperation({
        type: "set_map_token",
        placement: { userId: "p1", q: 0.5, r: 0 },
      }),
    ).toBe("Invalid set_map_token operation.");
    expect(
      validateMapTokenOperation({
        type: "remove_map_token",
        userId: "",
      }),
    ).toBe("Invalid remove_map_token operation.");
  });
});
