import { describe, expect, it } from "vitest";
import { getLevelFromZoom, type LevelZoomThresholds } from "./levelAutoSwitch";

const thresholds: LevelZoomThresholds = {
  level1Max: 3,
  level2Max: 10
};

describe("level auto switch", () => {
  it("maps every zoom to exactly one deterministic level", () => {
    expect(getLevelFromZoom(0.12, thresholds)).toBe(1);
    expect(getLevelFromZoom(2.999, thresholds)).toBe(1);
    expect(getLevelFromZoom(3, thresholds)).toBe(2);
    expect(getLevelFromZoom(9.999, thresholds)).toBe(2);
    expect(getLevelFromZoom(10, thresholds)).toBe(3);
    expect(getLevelFromZoom(40, thresholds)).toBe(3);
  });
});
