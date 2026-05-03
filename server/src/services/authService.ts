import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash, type ScryptOptions } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  createUser,
  findUserByNormalizedUsername,
  normalizeUsername,
  sanitizeUsername,
  toUserRecord,
  type DbUser
} from "../repositories/userRepository.js";
import {
  createSession,
  findActiveSessionByTokenHash,
  revokeSession,
  revokeActiveSessionsForUser,
  touchSession,
  deleteExpiredSessions,
  getSessionDurationMs,
  type DbSession,
} from "../repositories/sessionRepository.js";
import type { UserRecord } from "../../../src/core/auth/authTypes.js";
import { signupBodySchema, loginBodySchema } from "../validation/httpSchemas.js";
import { AuthRequiredError } from "../errors.js";
import { getClientIp } from "../security/requestSecurity.js";
import {
  createServerRateLimiter,
  serverLimits,
  serverRuntimeConfig,
} from "../serverConfig.js";
import { logAuthFailureAudit } from "./auditLog.js";

const sessionCookieName = "simplehex_session";
const passwordKeyLength = 64;
const authRateLimiter = createServerRateLimiter();
let lastSessionCleanupAt = 0;

function scryptAsync(password: string, salt: string, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

export type AuthContext = {
  session: DbSession;
  user: DbUser;
};

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function buildAuthRateLimitKeys(
  request: IncomingMessage,
  action: "login" | "signup",
  input: unknown,
): string[] {
  const ipKey = `${action}:ip:${getClientIp(request)}`;
  const username =
    input && typeof input === "object" && "username" in input
      ? normalizeUsername(sanitizeUsername(input.username))
      : "";
  const usernameKey = `${action}:username:${username || "unknown"}`;

  return [ipKey, usernameKey];
}

function assertAuthRateLimit(
  request: IncomingMessage,
  action: "login" | "signup",
  input: unknown,
): void {
  const username =
    input && typeof input === "object" && "username" in input
      ? normalizeUsername(sanitizeUsername(input.username))
      : "unknown";
  const result = authRateLimiter.consumeMany(
    buildAuthRateLimitKeys(request, action, input),
    serverLimits.authRateLimitMaxAttempts,
    serverLimits.authRateLimitWindowMs,
  );

  if (!result.allowed) {
    logAuthFailureAudit({
      action,
      ip: getClientIp(request),
      reason: "rate_limited",
      retryAfterMs: result.retryAfterMs,
      username,
    });
    throw new Error("Too many requests.");
  }
}

function parseCookies(header: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>();

  if (!header) {
    return cookies;
  }

  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    const name = rawName?.trim();

    if (!name) {
      continue;
    }

    cookies.set(name, decodeURIComponent(rawValue.join("=")));
  }

  return cookies;
}

function serializeCookie(name: string, value: string, options: {
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: "Lax" | "Strict" | "None";
  secure?: boolean;
} = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  }

  parts.push(`Path=${options.path ?? "/"}`);
  parts.push(`SameSite=${options.sameSite ?? "Lax"}`);

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function appendSetCookie(response: ServerResponse, cookie: string): void {
  const previous = response.getHeader("Set-Cookie");

  if (!previous) {
    response.setHeader("Set-Cookie", cookie);
    return;
  }

  if (Array.isArray(previous)) {
    response.setHeader("Set-Cookie", [...previous, cookie]);
    return;
  }

  response.setHeader("Set-Cookie", [String(previous), cookie]);
}

function isSecureCookie(): boolean {
  return serverRuntimeConfig.secureCookies;
}

function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

function validateUsername(username: string): string | null {
  if (username.length < 3 || username.length > 32) {
    return "Username must be between 3 and 32 characters.";
  }

  if (!/^[a-zA-Z0-9 _-]+$/.test(username)) {
    return "Username can only contain letters, numbers, spaces, underscores, and dashes.";
  }

  return null;
}

function validatePassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  return null;
}

async function cleanupSessionsIfNeeded(): Promise<void> {
  const now = Date.now();

  if (now - lastSessionCleanupAt < serverLimits.sessionCleanupIntervalMs) {
    return;
  }

  lastSessionCleanupAt = now;
  await deleteExpiredSessions(new Date(now));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const key = await scryptAsync(password, salt, passwordKeyLength, {
    N: 16384,
    p: 1,
    r: 8
  });

  return `scrypt$16384$8$1$${salt}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [kind, rawN, rawR, rawP, salt, expected] = encoded.split("$");

  if (kind !== "scrypt" || !rawN || !rawR || !rawP || !salt || !expected) {
    return false;
  }

  const key = await scryptAsync(password, salt, passwordKeyLength, {
    N: Number(rawN),
    p: Number(rawP),
    r: Number(rawR)
  });
  const expectedBuffer = Buffer.from(expected, "base64url");

  return expectedBuffer.length === key.length && timingSafeEqual(expectedBuffer, key);
}

async function issueSession(response: ServerResponse, userId: string): Promise<void> {
  await cleanupSessionsIfNeeded();
  await revokeActiveSessionsForUser(userId);
  const token = createSessionToken();
  await createSession({
    tokenHash: hashSessionToken(token),
    userId
  });
  appendSetCookie(response, serializeCookie(sessionCookieName, token, {
    httpOnly: true,
    maxAge: getSessionDurationMs() / 1000,
    path: "/",
    sameSite: "Lax",
    secure: isSecureCookie()
  }));
}

export function clearSessionCookie(response: ServerResponse): void {
  appendSetCookie(response, serializeCookie(sessionCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "Lax",
    secure: isSecureCookie()
  }));
}

export async function signupUser(input: unknown, response: ServerResponse): Promise<UserRecord> {
  const parsed = signupBodySchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const username = sanitizeUsername(parsed.data.username);
  const usernameError = validateUsername(username);

  if (usernameError) {
    throw new Error(usernameError);
  }

  const passwordError = validatePassword(parsed.data.password);

  if (passwordError) {
    throw new Error(passwordError);
  }

  const existing = await findUserByNormalizedUsername(normalizeUsername(username));

  if (existing) {
    throw new Error("Username is already taken.");
  }

  const user = await createUser({
    passwordHash: await hashPassword(String(parsed.data.password)),
    username
  });
  await issueSession(response, user.id);
  return toUserRecord(user);
}

export async function signupUserFromRequest(
  request: IncomingMessage,
  input: unknown,
  response: ServerResponse,
): Promise<UserRecord> {
  assertAuthRateLimit(request, "signup", input);
  return signupUser(input, response);
}

export async function loginUser(
  input: unknown,
  response: ServerResponse,
): Promise<UserRecord> {
  const parsed = loginBodySchema.safeParse(input);

  if (!parsed.success) {
    throw new Error("Invalid username or password.");
  }

  const username = sanitizeUsername(parsed.data.username);
  const password = parsed.data.password;
  const user = await findUserByNormalizedUsername(normalizeUsername(username));

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new Error("Invalid username or password.");
  }

  await issueSession(response, user.id);
  return toUserRecord(user);
}

export async function loginUserFromRequest(
  request: IncomingMessage,
  input: unknown,
  response: ServerResponse,
): Promise<UserRecord> {
  assertAuthRateLimit(request, "login", input);

  try {
    return await loginUser(input, response);
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid username or password.") {
      const username =
        input && typeof input === "object" && "username" in input
          ? normalizeUsername(sanitizeUsername(input.username))
          : "unknown";

      logAuthFailureAudit({
        action: "login",
        ip: getClientIp(request),
        reason: "invalid_credentials",
        username,
      });
    }

    throw error;
  }
}

export async function getAuthContext(request: IncomingMessage): Promise<AuthContext | null> {
  await cleanupSessionsIfNeeded();
  const token = parseCookies(request.headers.cookie).get(sessionCookieName);

  if (!token) {
    return null;
  }

  const result = await findActiveSessionByTokenHash(hashSessionToken(token));

  if (!result) {
    return null;
  }

  await touchSession(result.session.id);
  return result;
}

export async function requireAuth(request: IncomingMessage): Promise<AuthContext> {
  const context = await getAuthContext(request);

  if (!context) {
    throw new AuthRequiredError();
  }

  return context;
}

export async function logoutUser(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const context = await getAuthContext(request);

  if (context) {
    await revokeSession(context.session.id);
  }

  clearSessionCookie(response);
}
