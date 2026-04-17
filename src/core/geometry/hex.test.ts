import { describe, expect, it } from "vitest";
import {
  axialDirections,
  axialToScreenPixel,
  axialToWorldPixel,
  coarseToFine,
  convertAxialBetweenLevels,
  fineToCoarse,
  getChildCluster,
  hexKey,
  parseHexKey,
  roundAxial,
  screenPixelToAxial,
  type Axial
} from "./hex";

function expectAxialClose(actual: Axial, expected: Axial) {
  expect(actual.q).toBeCloseTo(expected.q, 10);
  expect(actual.r).toBeCloseTo(expected.r, 10);
}

describe("hex geometry", () => {
  it("roundtrips axial keys", () => {
    const axial = { q: -12, r: 7 };

    expect(parseHexKey(hexKey(axial))).toEqual(axial);
  });

  it("keeps the required six axial directions", () => {
    expect(axialDirections).toEqual([
      { q: 1, r: 0 },
      { q: -1, r: 0 },
      { q: 0, r: 1 },
      { q: 0, r: -1 },
      { q: 1, r: -1 },
      { q: -1, r: 1 }
    ]);
  });

  it("maps one parent hex to a seven-hex child cluster", () => {
    const center = coarseToFine({ q: 1, r: 0 });

    expect(getChildCluster({ q: 1, r: 0 })).toEqual([
      center,
      { q: center.q + 1, r: center.r },
      { q: center.q - 1, r: center.r },
      { q: center.q, r: center.r + 1 },
      { q: center.q, r: center.r - 1 },
      { q: center.q + 1, r: center.r - 1 },
      { q: center.q - 1, r: center.r + 1 }
    ]);
  });

  it("inverts the matrix transform for fractional centers", () => {
    const center = { q: 2.25, r: -3.5 };
    const transformed = coarseToFine(center);

    expectAxialClose(fineToCoarse(transformed), center);
  });

  it("roundtrips screen and axial coordinates", () => {
    const viewport = { x: 900, y: 600 };
    const center = { q: -1.25, r: 2.5 };
    const axial = { q: 5, r: -4 };
    const screen = axialToScreenPixel(axial, center, 1, 1.3, viewport);
    const decoded = screenPixelToAxial(screen, center, 1, 1.3, viewport);

    expect(roundAxial(decoded)).toEqual(axial);
  });

  it("keeps adjacent level coordinates in the same world position", () => {
    const coarse = { q: 4, r: -3 };
    const fine = coarseToFine(coarse);
    const coarsePixel = axialToWorldPixel(coarse, 1);
    const finePixel = axialToWorldPixel(fine, 2);

    expect(finePixel.x).toBeCloseTo(coarsePixel.x, 10);
    expect(finePixel.y).toBeCloseTo(coarsePixel.y, 10);
  });

  it("converts camera centers between levels through stable world coordinates", () => {
    const levelOneCenter = { q: 2.5, r: -1.75 };
    const levelThreeCenter = convertAxialBetweenLevels(levelOneCenter, 1, 3);
    const roundtripped = convertAxialBetweenLevels(levelThreeCenter, 3, 1);
    const worldBefore = axialToWorldPixel(levelOneCenter, 1);
    const worldAfter = axialToWorldPixel(levelThreeCenter, 3);

    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 10);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 10);
    expectAxialClose(roundtripped, levelOneCenter);
  });
});
