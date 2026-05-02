import type { IncomingMessage, ServerResponse } from "node:http";
import { ForbiddenError } from "../errors.js";
import { serverLimits } from "../serverConfig.js";

function normalizeOrigin(value: string): string | null {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.origin
      : null;
  } catch {
    return null;
  }
}

function getForwardedHeaderValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    const first = value.split(",")[0]?.trim();
    return first || null;
  }

  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }

  return null;
}

export function getRequestOrigin(request: IncomingMessage): string | null {
  const host = getForwardedHeaderValue(request.headers["x-forwarded-host"])
    ?? getForwardedHeaderValue(request.headers.host);

  if (!host) {
    return null;
  }

  const protocolHeader = getForwardedHeaderValue(
    request.headers["x-forwarded-proto"],
  );
  const protocol = protocolHeader === "https" || protocolHeader === "http"
    ? protocolHeader
    : "encrypted" in request.socket && request.socket.encrypted
      ? "https"
      : "http";

  return `${protocol}://${host}`;
}

function getOriginFromReferer(referer: string | undefined): string | null {
  if (!referer) {
    return null;
  }

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function isOriginAllowed(
  request: IncomingMessage,
  origin: string,
  allowedOrigins: readonly string[] = serverLimits.allowedOrigins,
): boolean {
  const normalizedOrigin = normalizeOrigin(origin);

  if (!normalizedOrigin) {
    return false;
  }

  const requestOrigin = getRequestOrigin(request);

  if (requestOrigin && normalizedOrigin === requestOrigin) {
    return true;
  }

  return allowedOrigins.includes(normalizedOrigin);
}

function getCorsAllowedOrigin(
  origin: string,
  allowedOrigins: readonly string[] = serverLimits.allowedOrigins,
): string | null {
  const normalizedOrigin = normalizeOrigin(origin);

  if (!normalizedOrigin) {
    return null;
  }

  return allowedOrigins.find((value) => value === normalizedOrigin) ?? null;
}

export function applySecurityHeaders(response: ServerResponse): void {
  response.setHeader("Referrer-Policy", "same-origin");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
}

export function setCors(request: IncomingMessage, response: ServerResponse): void {
  const origin = getForwardedHeaderValue(request.headers.origin);
  const allowedOrigin = origin ? getCorsAllowedOrigin(origin) : null;

  if (allowedOrigin) {
    response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PATCH,DELETE,OPTIONS",
    );
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.setHeader("Vary", "Origin");
  }
}

export function assertRequestOriginAllowed(request: IncomingMessage): void {
  const requestMethod = request.method ?? "GET";

  if (requestMethod === "GET" || requestMethod === "HEAD" || requestMethod === "OPTIONS") {
    return;
  }

  const origin = getForwardedHeaderValue(request.headers.origin);

  if (origin) {
    if (!isOriginAllowed(request, origin)) {
      throw new ForbiddenError("Request origin denied.");
    }

    return;
  }

  const refererOrigin = getOriginFromReferer(
    getForwardedHeaderValue(request.headers.referer) ?? undefined,
  );

  if (refererOrigin && isOriginAllowed(request, refererOrigin)) {
    return;
  }

  throw new ForbiddenError("Request origin denied.");
}

export function isCorsPreflightAllowed(request: IncomingMessage): boolean {
  const origin = getForwardedHeaderValue(request.headers.origin);
  return origin ? isOriginAllowed(request, origin) : true;
}

export function getClientIp(request: IncomingMessage): string {
  return getForwardedHeaderValue(request.headers["x-forwarded-for"])
    ?? request.socket.remoteAddress
    ?? "unknown";
}
