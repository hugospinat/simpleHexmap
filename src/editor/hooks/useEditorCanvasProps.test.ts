import { describe, expect, it } from "vitest";
import { shouldShowFogVisibilityOverlay } from "./useEditorCanvasProps";

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
