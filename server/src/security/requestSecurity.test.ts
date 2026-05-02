import { describe, expect, it } from "vitest";
import {
  assertRequestOriginAllowed,
  getRequestOrigin,
  isCorsPreflightAllowed,
  isOriginAllowed,
} from "./requestSecurity.js";

function createRequest(input: {
  headers?: Record<string, string>;
  method?: string;
} = {}) {
  return {
    headers: input.headers ?? {},
    method: input.method ?? "GET",
    socket: { remoteAddress: "127.0.0.1" },
  };
}

describe("requestSecurity", () => {
  it("derives the request origin from forwarded headers", () => {
    expect(getRequestOrigin(createRequest({
      headers: {
        host: "internal.example.test",
        "x-forwarded-host": "app.example.com",
        "x-forwarded-proto": "https",
      },
    }))).toBe("https://app.example.com");
  });

  it("allows same-origin requests without a custom allowlist", () => {
    const request = createRequest({
      headers: {
        host: "localhost:8787",
      },
    });

    expect(isOriginAllowed(request, "http://localhost:8787")).toBe(true);
    expect(isOriginAllowed(request, "https://evil.example.com")).toBe(false);
  });

  it("allows preflight requests only for approved origins", () => {
    expect(isCorsPreflightAllowed(createRequest({
      headers: {
        origin: "http://localhost:8787",
        host: "localhost:8787",
      },
    }))).toBe(true);

    expect(isCorsPreflightAllowed(createRequest({
      headers: {
        origin: "https://app.example.com",
        host: "localhost:8787",
      },
    }))).toBe(false);
  });

  it("rejects mutating requests with a denied origin", () => {
    expect(() => assertRequestOriginAllowed(createRequest({
      headers: {
        host: "localhost:8787",
        origin: "https://evil.example.com",
      },
      method: "POST",
    }))).toThrowError("Request origin denied.");
  });

  it("accepts mutating requests with a matching referer origin", () => {
    expect(() => assertRequestOriginAllowed(createRequest({
      headers: {
        host: "localhost:8787",
        referer: "http://localhost:8787/app",
      },
      method: "DELETE",
    }))).not.toThrow();
  });
});
