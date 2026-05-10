import { describe, expect, it } from "vitest";
import {
  buildObsidianNoteFilePath,
  hasObsidianNoteConflict,
  sanitizeObsidianNoteDraft,
} from "./obsidianNoteSync.js";

describe("obsidianNoteSync", () => {
  it("builds stable per-map note file paths", () => {
    expect(
      buildObsidianNoteFilePath({
        mapId: "map-1",
        mapName: "My Test Map",
        q: -2,
        r: 5,
      }),
    ).toBe("SimpleHex/my-test-map-map-1/hex--2-5.md");
  });

  it("detects optimistic revision conflicts", () => {
    expect(
      hasObsidianNoteConflict(
        {
          operationId: "op-1",
          sourceClientId: "client-a",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          operationId: "op-2",
          sourceClientId: "client-b",
          updatedAt: "2026-01-01T00:00:01.000Z",
        },
      ),
    ).toBe(true);
  });

  it("normalizes blank note fields to nulls", () => {
    expect(
      sanitizeObsidianNoteDraft({
        gmTitle: "  GM  ",
        markdown: "   ",
        playerTitle: "",
      }),
    ).toEqual({
      gmTitle: "GM",
      markdown: null,
      playerTitle: null,
    });
  });
});

