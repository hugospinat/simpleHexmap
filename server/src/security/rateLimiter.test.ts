import { describe, expect, it } from "vitest";
import { MemoryRateLimiter } from "./rateLimiter.js";

describe("MemoryRateLimiter", () => {
  it("allows requests until the limit is reached within the window", () => {
    let now = 1_000;
    const limiter = new MemoryRateLimiter(() => now);

    expect(limiter.consume("auth:127.0.0.1", 2, 1000)).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(limiter.consume("auth:127.0.0.1", 2, 1000)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(limiter.consume("auth:127.0.0.1", 2, 1000)).toMatchObject({
      allowed: false,
      remaining: 0,
    });

    now += 1_001;

    expect(limiter.consume("auth:127.0.0.1", 2, 1000)).toMatchObject({
      allowed: true,
      remaining: 1,
    });
  });
});
