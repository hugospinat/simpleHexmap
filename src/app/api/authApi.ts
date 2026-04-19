import { buildApiUrl } from "@/app/api/apiBase";
import type { UserRecord } from "@/core/auth/authTypes";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseUser(raw: unknown): UserRecord {
  if (
    !isObject(raw)
    || typeof raw.id !== "string"
    || typeof raw.username !== "string"
    || typeof raw.createdAt !== "string"
    || typeof raw.updatedAt !== "string"
  ) {
    throw new Error("Invalid user response.");
  }

  return {
    id: raw.id,
    username: raw.username,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt
  };
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(buildApiUrl(path), {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const payload = await response.json() as unknown;

  if (!response.ok) {
    const errorMessage = isObject(payload) && typeof payload.error === "string"
      ? payload.error
      : `Request failed with status ${response.status}.`;
    throw new Error(errorMessage);
  }

  return payload;
}

function parseUserPayload(payload: unknown): UserRecord {
  if (!isObject(payload) || !("user" in payload)) {
    throw new Error("Invalid auth response.");
  }

  return parseUser(payload.user);
}

export async function getCurrentUser(): Promise<UserRecord | null> {
  const response = await fetch(buildApiUrl("/api/auth/me"), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (response.status === 401) {
    return null;
  }

  const payload = await response.json() as unknown;

  if (!response.ok) {
    throw new Error("Could not load current user.");
  }

  return parseUserPayload(payload);
}

export async function login(username: string, password: string): Promise<UserRecord> {
  return parseUserPayload(await requestJson("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ password, username })
  }));
}

export async function signup(username: string, password: string): Promise<UserRecord> {
  return parseUserPayload(await requestJson("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ password, username })
  }));
}

export async function logout(): Promise<void> {
  await requestJson("/api/auth/logout", { method: "POST" });
}
