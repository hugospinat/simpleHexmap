import { describe, expect, it } from "vitest";
import { buildAuthRateLimitKeys } from "./authService.js";

function createRequest(
  headers: Record<string, string> = {},
  remoteAddress = "127.0.0.1",
) {
  return {
    headers,
    socket: {
      remoteAddress,
    },
  };
}

describe("buildAuthRateLimitKeys", () => {
  it("keys auth rate limits by both client IP and normalized username", () => {
    expect(
      buildAuthRateLimitKeys(
        createRequest({ "x-forwarded-for": "10.0.0.2, 10.0.0.3" }),
        "login",
        { username: "  Alice   Example  " },
      ),
    ).toEqual([
      "login:ip:10.0.0.2",
      "login:username:alice example",
    ]);
  });

  it("falls back to an unknown username bucket for malformed payloads", () => {
    expect(
      buildAuthRateLimitKeys(
        createRequest(),
        "signup",
        { password: "secret" },
      ),
    ).toEqual([
      "signup:ip:127.0.0.1",
      "signup:username:unknown",
    ]);
  });
});
