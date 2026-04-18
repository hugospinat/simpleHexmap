import { buildApiUrl } from "@/app/api/apiBase";
import type { ProfileRecord } from "@/core/profile/profileTypes";

const profileStorageKey = "simplehex:profile-id";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseProfile(raw: unknown): ProfileRecord {
  if (
    !isObject(raw)
    || typeof raw.id !== "string"
    || typeof raw.username !== "string"
    || typeof raw.createdAt !== "string"
    || typeof raw.updatedAt !== "string"
  ) {
    throw new Error("Invalid profile response.");
  }

  return {
    id: raw.id,
    username: raw.username,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt
  };
}

export function getStoredProfileId(): string | null {
  try {
    return window.localStorage.getItem(profileStorageKey);
  } catch {
    return null;
  }
}

export function rememberProfileId(profileId: string): void {
  try {
    window.localStorage.setItem(profileStorageKey, profileId);
  } catch {
    // The selected profile still works for this session.
  }
}

async function requestProfiles(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  const payload = await response.json() as unknown;

  if (!response.ok) {
    throw new Error("Could not load profiles.");
  }

  return payload;
}

export async function listProfiles(): Promise<ProfileRecord[]> {
  const payload = await requestProfiles("/api/profiles", { method: "GET" });

  if (!isObject(payload) || !Array.isArray(payload.profiles)) {
    throw new Error("Invalid profiles response.");
  }

  return payload.profiles.map(parseProfile);
}

export async function ensureProfile(input: { profileId?: string; username?: string }): Promise<ProfileRecord> {
  const payload = await requestProfiles("/api/profiles", {
    method: "POST",
    body: JSON.stringify(input)
  });

  if (!isObject(payload) || !("profile" in payload)) {
    throw new Error("Could not load profile.");
  }

  const profile = parseProfile(payload.profile);
  rememberProfileId(profile.id);
  return profile;
}

export async function createProfile(username: string): Promise<ProfileRecord> {
  return ensureProfile({ username });
}
