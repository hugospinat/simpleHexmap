import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { readBody } from "./httpHelpers.js";

function createRequest(headers: Record<string, string> = {}) {
  const request = new EventEmitter() as EventEmitter & {
    destroy: () => void;
    headers: Record<string, string>;
  };
  request.headers = headers;
  request.destroy = () => undefined;
  return request;
}

describe("httpHelpers.readBody", () => {
  it("rejects early when content-length exceeds the configured limit", async () => {
    const request = createRequest({ "content-length": String(6 * 1024 * 1024) });

    await expect(readBody(request)).rejects.toMatchObject({
      message: "Request body too large.",
      statusCode: 413,
    });
  });

  it("measures request size in bytes for utf-8 payloads", async () => {
    const request = createRequest();
    const bodyPromise = readBody(request);

    request.emit("data", Buffer.alloc(5 * 1024 * 1024, "a"));
    request.emit("data", Buffer.from("é"));

    await expect(bodyPromise).rejects.toMatchObject({
      message: "Request body too large.",
      statusCode: 413,
    });
  });
});
