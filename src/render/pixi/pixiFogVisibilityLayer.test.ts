import { describe, expect, it } from "vitest";
import { shouldDrawPixiFogVisibilityLayer } from "./pixiFogVisibilityLayer";

describe("pixi fog visibility layer", () => {
  it("draws persistent fog only for GM fog editing", () => {
    expect(shouldDrawPixiFogVisibilityLayer("gm", true)).toBe(true);
    expect(shouldDrawPixiFogVisibilityLayer("gm", false)).toBe(false);
    expect(shouldDrawPixiFogVisibilityLayer("player", true)).toBe(false);
    expect(shouldDrawPixiFogVisibilityLayer("player", false)).toBe(false);
  });
});
