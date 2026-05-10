import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { ForbiddenError } from "../errors.js";
import { getMapRoleForUser } from "../repositories/mapRepository.js";
import { canOpenAsGm } from "../repositories/workspaceRepository.js";
import { serverLimits, serverRuntimeConfig } from "../serverConfig.js";
import { AuthRequiredError } from "../errors.js";

type ObsidianTokenPayload = {
  exp: number;
  mapId: string;
  scope: "obsidian_note";
  userId: string;
  version: 1;
};

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function signPayload(payloadSegment: string): Buffer {
  return createHmac("sha256", serverRuntimeConfig.obsidianTokenSecret)
    .update(payloadSegment)
    .digest();
}

export function issueObsidianMapToken(input: {
  expiresAtMs?: number;
  mapId: string;
  userId: string;
}): { expiresAt: string; token: string } {
  const expiresAtMs = input.expiresAtMs ?? Date.now() + serverLimits.obsidianTokenLifetimeMs;
  const payload: ObsidianTokenPayload = {
    exp: expiresAtMs,
    mapId: input.mapId,
    scope: "obsidian_note",
    userId: input.userId,
    version: 1,
  };
  const payloadSegment = encodeBase64Url(JSON.stringify(payload));
  const signatureSegment = signPayload(payloadSegment).toString("base64url");

  return {
    expiresAt: new Date(expiresAtMs).toISOString(),
    token: `${payloadSegment}.${signatureSegment}`,
  };
}

export function verifyObsidianMapToken(token: string): ObsidianTokenPayload | null {
  const [payloadSegment, signatureSegment] = token.split(".");

  if (!payloadSegment || !signatureSegment) {
    return null;
  }

  const payloadJson = decodeBase64Url(payloadSegment);
  const providedSignature = Buffer.from(signatureSegment, "base64url");
  const expectedSignature = signPayload(payloadSegment);

  if (
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(providedSignature, expectedSignature) ||
    !payloadJson
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(payloadJson) as Partial<ObsidianTokenPayload>;

    if (
      parsed.version !== 1 ||
      parsed.scope !== "obsidian_note" ||
      typeof parsed.userId !== "string" ||
      typeof parsed.mapId !== "string" ||
      typeof parsed.exp !== "number" ||
      parsed.exp <= Date.now()
    ) {
      return null;
    }

    return {
      exp: parsed.exp,
      mapId: parsed.mapId,
      scope: "obsidian_note",
      userId: parsed.userId,
      version: 1,
    };
  } catch {
    return null;
  }
}

function readBearerToken(request: IncomingMessage): string | null {
  const header = request.headers.authorization;

  if (!header) {
    return null;
  }

  const [scheme, token] = header.trim().split(/\s+/, 2);
  return scheme === "Bearer" && token ? token : null;
}

export async function requireObsidianMapAuth(
  request: IncomingMessage,
  mapId: string,
): Promise<{ expiresAt: string; userId: string }> {
  const bearerToken = readBearerToken(request);

  if (!bearerToken) {
    throw new AuthRequiredError("Obsidian token required.");
  }

  const payload = verifyObsidianMapToken(bearerToken);

  if (!payload || payload.mapId !== mapId) {
    throw new AuthRequiredError("Invalid Obsidian token.");
  }

  const role = await getMapRoleForUser(mapId, payload.userId);

  if (!canOpenAsGm(role)) {
    throw new ForbiddenError("GM access denied.");
  }

  return {
    expiresAt: new Date(payload.exp).toISOString(),
    userId: payload.userId,
  };
}

