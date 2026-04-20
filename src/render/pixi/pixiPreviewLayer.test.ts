import { describe, expect, it } from "vitest";
import {
  getPreviewFactionOverlayStyle,
  getPreviewRoadEdgeChanges,
} from "./pixiPreviewLayer";

describe("getPreviewRoadEdgeChanges", () => {
  it("only previews removed road edges when a cell keeps other roads", () => {
    expect(getPreviewRoadEdgeChanges([2, 5], [5])).toEqual({
      added: [],
      removed: [2],
    });
  });

  it("only previews added road edges for new connections", () => {
    expect(getPreviewRoadEdgeChanges([], [2])).toEqual({
      added: [2],
      removed: [],
    });
  });
});

describe("getPreviewFactionOverlayStyle", () => {
  it("returns a removal overlay when clearing an existing faction", () => {
    expect(getPreviewFactionOverlayStyle("#112233", null)).toMatchObject({
      removed: true,
      color: 0xffffff,
    });
  });

  it("returns the target faction overlay when assigning a faction", () => {
    expect(getPreviewFactionOverlayStyle(null, "#112233")).toMatchObject({
      removed: false,
    });
  });

  it("returns null when there is no current or target faction", () => {
    expect(getPreviewFactionOverlayStyle(null, null)).toBeNull();
  });
});
