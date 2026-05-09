import { describe, expect, it } from "vitest";
import {
  resolveNoteLabelsForCanvas,
  shouldShowFogVisibilityOverlay,
} from "./useEditorCanvasProps";

describe("shouldShowFogVisibilityOverlay", () => {
  it("shows the fog visibility overlay for gm fog mode", () => {
    expect(shouldShowFogVisibilityOverlay("fog", "gm")).toBe(true);
  });

  it("shows the fog visibility overlay for gm token mode", () => {
    expect(shouldShowFogVisibilityOverlay("token", "gm")).toBe(true);
  });

  it("hides the fog visibility overlay for other modes and players", () => {
    expect(shouldShowFogVisibilityOverlay("terrain", "gm")).toBe(false);
    expect(shouldShowFogVisibilityOverlay("token", "player")).toBe(false);
  });
});

describe("resolveNoteLabelsForCanvas", () => {
  const notes = [
    {
      q: 0,
      r: 0,
      gmTitle: "GM Camp",
      playerTitle: "Camp",
      markdown: "# Camp",
    },
  ] as const;

  it("renders note labels only on source level 3", () => {
    expect(resolveNoteLabelsForCanvas(notes, 3, "gm", false)).toEqual([
      { q: 0, r: 0, text: "GM Camp" },
    ]);
    expect(resolveNoteLabelsForCanvas(notes, 2, "gm", false)).toEqual([]);
    expect(resolveNoteLabelsForCanvas(notes, 1, "player", false)).toEqual([]);
  });

  it("switches between gm and player titles on source level 3", () => {
    expect(resolveNoteLabelsForCanvas(notes, 3, "gm", false)).toEqual([
      { q: 0, r: 0, text: "GM Camp" },
    ]);
    expect(resolveNoteLabelsForCanvas(notes, 3, "gm", true)).toEqual([
      { q: 0, r: 0, text: "Camp" },
    ]);
    expect(resolveNoteLabelsForCanvas(notes, 3, "player", false)).toEqual([
      { q: 0, r: 0, text: "Camp" },
    ]);
  });
});
