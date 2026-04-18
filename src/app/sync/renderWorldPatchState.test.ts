import { describe, expect, it } from "vitest";
import type { RenderWorldPatch } from "@/render/renderWorldPatch";
import { mergeRenderWorldPatch } from "./renderWorldPatchState";

describe("renderWorldPatchState", () => {
  it("accumulates operation patches that have not been acknowledged by the renderer", () => {
    const previous: RenderWorldPatch = {
      operations: [
        { type: "set_tile", tile: { q: 0, r: 0, terrain: "plain", hidden: false } }
      ],
      revision: 1,
      type: "operations"
    };

    const next = mergeRenderWorldPatch(previous, 0, {
      operations: [
        { type: "set_tile", tile: { q: 1, r: 0, terrain: "forest", hidden: false } }
      ],
      type: "operations"
    }, 2);

    expect(next).toEqual({
      operations: [
        { type: "set_tile", tile: { q: 0, r: 0, terrain: "plain", hidden: false } },
        { type: "set_tile", tile: { q: 1, r: 0, terrain: "forest", hidden: false } }
      ],
      revision: 2,
      type: "operations"
    });
  });

  it("does not carry acknowledged operation patches forward", () => {
    const previous: RenderWorldPatch = {
      operations: [
        { type: "set_tile", tile: { q: 0, r: 0, terrain: "plain", hidden: false } }
      ],
      revision: 1,
      type: "operations"
    };

    const next = mergeRenderWorldPatch(previous, 1, {
      operations: [
        { type: "set_tile", tile: { q: 1, r: 0, terrain: "forest", hidden: false } }
      ],
      type: "operations"
    }, 2);

    expect(next).toEqual({
      operations: [
        { type: "set_tile", tile: { q: 1, r: 0, terrain: "forest", hidden: false } }
      ],
      revision: 2,
      type: "operations"
    });
  });

  it("snapshot patches replace pending operation patches", () => {
    const previous: RenderWorldPatch = {
      operations: [
        { type: "set_tile", tile: { q: 0, r: 0, terrain: "plain", hidden: false } }
      ],
      revision: 1,
      type: "operations"
    };

    expect(mergeRenderWorldPatch(previous, 0, { type: "snapshot" }, 2)).toEqual({
      revision: 2,
      type: "snapshot"
    });
  });
});
