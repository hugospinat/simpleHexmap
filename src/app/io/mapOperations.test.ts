import { describe, expect, test } from "vitest";
import { addFeature, addTile, createEmptyWorld, setCellHidden, updateFeature } from "@/domain/world/world";
import { applyMapOperation, diffWorldAsOperations } from "@/app/io/mapOperations";
import { serializeWorld } from "@/app/io/mapFormat";

describe("mapOperations", () => {
  test("set_tile updates snapshots incrementally", () => {
    const empty = serializeWorld(createEmptyWorld());
    const updated = applyMapOperation(empty, {
      type: "set_tile",
      tile: { q: 2, r: 1, tileId: "forest", hidden: false }
    });

    expect(updated.tiles).toEqual([{ q: 2, r: 1, tileId: "forest", hidden: false }]);
  });

  test("world diffs emit targeted operations", () => {
    const previous = createEmptyWorld();
    const nextWorld = addTile(previous, 3, { q: 0, r: 0 }, "plain");

    const operations = diffWorldAsOperations(previous, nextWorld);
    expect(operations).toEqual([
      {
        type: "set_tile",
        tile: { q: 0, r: 0, tileId: "plain", hidden: false }
      }
    ]);
  });

  test("world diffs emit set_cell_hidden for fog changes", () => {
    const previous = addTile(createEmptyWorld(), 3, { q: 0, r: 0 }, "plain");
    const next = setCellHidden(previous, 3, { q: 0, r: 0 }, true);

    expect(diffWorldAsOperations(previous, next)).toEqual([
      {
        type: "set_cell_hidden",
        cell: { q: 0, r: 0, hidden: true }
      }
    ]);
  });

  test("world diffs emit set_feature_hidden for feature fog changes", () => {
    const previous = addFeature(createEmptyWorld(), 3, {
      id: "f-1",
      kind: "city",
      hexId: "0,0",
      hidden: false
    });
    const next = updateFeature(previous, 3, "f-1", { hidden: true });

    expect(diffWorldAsOperations(previous, next)).toEqual([
      {
        type: "set_feature_hidden",
        featureId: "f-1",
        hidden: true
      }
    ]);
  });
});
