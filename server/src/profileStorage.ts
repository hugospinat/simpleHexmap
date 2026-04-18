import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ProfileRecord } from "./types.js";
import { isObject, nowIso, sanitizeName } from "./mapStorage.js";

const profilesDir = path.resolve(process.cwd(), "data/profiles");
const profileIdPattern = /^[a-zA-Z0-9_-]{1,80}$/;

function profilePathFromId(profileId: string): string | null {
  if (!profileIdPattern.test(profileId)) {
    return null;
  }

  return path.join(profilesDir, `${profileId}.json`);
}

async function ensureProfileStorage(): Promise<void> {
  await fs.mkdir(profilesDir, { recursive: true });
}

export function createProfileId(): string {
  return `profile-${randomUUID()}`;
}

export function sanitizeUsername(value: unknown): string {
  const fallback = "Player";
  const name = sanitizeName(value);
  return name === "Untitled map" ? fallback : name;
}

export async function readProfile(profileId: string): Promise<ProfileRecord | null> {
  const filePath = profilePathFromId(profileId);

  if (!filePath) {
    return null;
  }

  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;

    if (!isObject(parsed) || typeof parsed.id !== "string" || typeof parsed.username !== "string") {
      return null;
    }

    return {
      id: parsed.id,
      username: parsed.username,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : nowIso(),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : nowIso()
    };
  } catch {
    return null;
  }
}

export async function writeProfile(profile: ProfileRecord): Promise<void> {
  const filePath = profilePathFromId(profile.id);

  if (!filePath) {
    throw new Error("Invalid profile id.");
  }

  await ensureProfileStorage();
  await fs.writeFile(filePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
}

export async function listProfiles(): Promise<ProfileRecord[]> {
  await ensureProfileStorage();

  const entries = await fs.readdir(profilesDir, { withFileTypes: true });
  const profiles: ProfileRecord[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const profileId = entry.name.slice(0, -".json".length);
    const profile = await readProfile(profileId);

    if (profile) {
      profiles.push(profile);
    }
  }

  profiles.sort((left, right) => {
    const byName = left.username.localeCompare(right.username);
    return byName === 0 ? left.createdAt.localeCompare(right.createdAt) : byName;
  });
  return profiles;
}

export async function ensureProfile(input: { profileId?: unknown; username?: unknown }): Promise<ProfileRecord> {
  const requestedId = typeof input.profileId === "string" && profileIdPattern.test(input.profileId)
    ? input.profileId
    : createProfileId();
  const existing = await readProfile(requestedId);
  const now = nowIso();

  if (existing) {
    const username = typeof input.username === "string" && input.username.trim()
      ? sanitizeUsername(input.username)
      : existing.username;
    const updated = username === existing.username
      ? existing
      : { ...existing, username, updatedAt: now };

    if (updated !== existing) {
      await writeProfile(updated);
    }

    return updated;
  }

  const profile = {
    id: requestedId,
    username: sanitizeUsername(input.username),
    createdAt: now,
    updatedAt: now
  };
  await writeProfile(profile);
  return profile;
}
