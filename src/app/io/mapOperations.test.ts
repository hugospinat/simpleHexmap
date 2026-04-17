import { describe, expect, test } from "vitest";
import { addTile, createEmptyWorld } from "@/domain/world/world";
import { applyMapOperation, diffWorldAsOperations } from "@/app/io/mapOperations";
import { serializeWorld } from "@/app/io/mapFormat";

describe("mapOperations", () => {
  test("set_tile updates snapshots incrementally", () => {
    const empty = serializeWorld(createEmptyWorld());
    const updated = applyMapOperation(empty, {
      type: "set_tile",
      tile: { q: 2, r: 1, tileId: "forest" }
    });

    expect(updated.tiles).toEqual([{ q: 2, r: 1, tileId: "forest" }]);
  });

  test("world diffs emit targeted operations", () => {
    const previous = createEmptyWorld();
    const nextWorld = addTile(previous, 3, { q: 0, r: 0 }, "plain");

    const operations = diffWorldAsOperations(previous, nextWorld);
    expect(operations).toEqual([
      {
        type: "set_tile",
        tile: { q: 0, r: 0, tileId: "plain" }
      }
    ]);
  });
});
