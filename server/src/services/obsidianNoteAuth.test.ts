import { describe, expect, it } from "vitest";
import { issueObsidianMapToken, verifyObsidianMapToken } from "./obsidianNoteAuth.js";

describe("obsidianNoteAuth", () => {
  it("issues and verifies scoped Obsidian tokens", () => {
    const { token } = issueObsidianMapToken({
      expiresAtMs: Date.now() + 60_000,
      mapId: "map-1",
      userId: "user-1",
    });

    expect(verifyObsidianMapToken(token)).toMatchObject({
      mapId: "map-1",
      scope: "obsidian_note",
      userId: "user-1",
      version: 1,
    });
  });

  it("rejects tampered tokens", () => {
    const { token } = issueObsidianMapToken({
      expiresAtMs: Date.now() + 60_000,
      mapId: "map-1",
      userId: "user-1",
    });

    expect(verifyObsidianMapToken(`${token}tampered`)).toBeNull();
  });
});

