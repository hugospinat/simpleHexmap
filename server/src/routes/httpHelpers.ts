import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { parseSavedMapContent } from "../../../src/core/document/savedMapCodec.js";

const maxRequestBodySizeBytes = 50 * 1024 * 1024;

const staticRoot = path.resolve(process.cwd(), "dist");
const staticContentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
]);

export const defaultMapContent = {
  version: 1,
  tiles: [{ q: 0, r: 0, terrain: "plain", hidden: true }],
  features: [],
  rivers: [],
  roads: [],
  factions: [],
  factionTerritories: [],
  tokens: [],
};

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function sanitizeName(value: unknown, fallback = "Untitled map"): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 120) : fallback;
}

export function setCors(request, response): void {
  const origin = request.headers.origin;
  response.setHeader("Access-Control-Allow-Origin", typeof origin === "string" ? origin : "*");
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Vary", "Origin");
}

export function sendJson(response, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(`${JSON.stringify(payload)}\n`);
}

export async function readBody(request): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = "";
    let rejected = false;

    request.on("data", (chunk) => {
      if (rejected) {
        return;
      }

      data += chunk;

      if (data.length > maxRequestBodySizeBytes) {
        rejected = true;
        reject(Object.assign(new Error("Request body too large."), { statusCode: 413 }));
      }
    });

    request.on("end", () => {
      if (rejected) {
        return;
      }

      if (!data.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(data));
      } catch {
        reject(Object.assign(new Error("Invalid JSON body."), { statusCode: 400 }));
      }
    });

    request.on("error", (error) => {
      if (!rejected) {
        reject(error);
      }
    });
  });
}

export function parseContentInput(value: unknown) {
  try {
    return parseSavedMapContent(value);
  } catch {
    return defaultMapContent;
  }
}

export function parseWorkspaceMemberRole(value: unknown): "gm" | "player" | null {
  if (value === "gm" || value === "player") {
    return value;
  }

  return null;
}

function sendStaticFile(response, filePath: string, method: string): void {
  const extension = path.extname(filePath).toLowerCase();
  response.statusCode = 200;
  response.setHeader("Content-Type", staticContentTypes.get(extension) ?? "application/octet-stream");

  if (extension !== ".html") {
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } else {
    response.setHeader("Cache-Control", "no-cache");
  }

  if (method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(filePath).pipe(response);
}

async function resolveStaticFile(pathname: string): Promise<string | null> {
  const decodedPathname = decodeURIComponent(pathname);
  const normalizedPathname = decodedPathname === "/" ? "/index.html" : decodedPathname;
  const candidate = path.resolve(staticRoot, `.${normalizedPathname}`);

  if (candidate.startsWith(staticRoot)) {
    try {
      const stats = await fs.stat(candidate);

      if (stats.isFile()) {
        return candidate;
      }
    } catch {
      // Fall back to the SPA entry below.
    }
  }

  const indexPath = path.join(staticRoot, "index.html");

  try {
    const stats = await fs.stat(indexPath);
    return stats.isFile() ? indexPath : null;
  } catch {
    return null;
  }
}

export async function handleStaticRequest(request, response, url): Promise<boolean> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }

  if (url.pathname.startsWith("/api/")) {
    return false;
  }

  const filePath = await resolveStaticFile(url.pathname);

  if (!filePath) {
    return false;
  }

  sendStaticFile(response, filePath, request.method);
  return true;
}
