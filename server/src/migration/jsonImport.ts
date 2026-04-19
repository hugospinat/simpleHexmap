import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { runDatabaseMigrations } from "../db/migrations.js";
import { users, workspaces, workspaceMembers } from "../db/schema.js";
import { replaceWorkspaceContent } from "../repositories/mapContentRepository.js";
import { normalizeUsername, sanitizeUsername } from "../repositories/userRepository.js";
import { hashPassword } from "../services/authService.js";
import { parseSavedMapContent } from "../../../src/core/document/savedMapCodec.js";
import type { SavedMapContent } from "../../../src/core/protocol/index.js";

type LegacyProfile = {
  id: string;
  username: string;
  createdAt?: string;
  updatedAt?: string;
};

type LegacyMap = {
  id: string;
  name: string;
  updatedAt?: string;
  permissions?: {
    ownerProfileId?: string;
    gmProfileIds?: string[];
  };
  content: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseArgs(): { dataDir: string; defaultPassword: string } {
  const defaultPasswordArg = process.argv.find((arg) => arg.startsWith("--default-password="));
  const dataDirArg = process.argv.find((arg) => arg.startsWith("--data-dir="));

  return {
    dataDir: dataDirArg ? path.resolve(dataDirArg.slice("--data-dir=".length)) : path.resolve(process.cwd(), "data"),
    defaultPassword: defaultPasswordArg?.slice("--default-password=".length) || "changeme123"
  };
}

function toDate(value: unknown): Date {
  if (typeof value === "string") {
    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

async function readJsonFiles<T>(directory: string, parse: (raw: unknown) => T | null): Promise<T[]> {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const records: T[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      try {
        const raw = JSON.parse(await fs.readFile(path.join(directory, entry.name), "utf8")) as unknown;
        const parsed = parse(raw);

        if (parsed) {
          records.push(parsed);
        }
      } catch (error) {
        console.warn(`[jsonImport] skipped ${entry.name}:`, error instanceof Error ? error.message : error);
      }
    }

    return records;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function parseLegacyProfile(raw: unknown): LegacyProfile | null {
  if (!isObject(raw) || typeof raw.id !== "string" || typeof raw.username !== "string") {
    return null;
  }

  return {
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : undefined,
    id: raw.id,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
    username: raw.username
  };
}

function parseLegacyMap(raw: unknown): LegacyMap | null {
  if (!isObject(raw) || typeof raw.id !== "string" || typeof raw.name !== "string" || !("content" in raw)) {
    return null;
  }

  return {
    content: raw.content,
    id: raw.id,
    name: raw.name,
    permissions: isObject(raw.permissions)
      ? {
        gmProfileIds: Array.isArray(raw.permissions.gmProfileIds)
          ? raw.permissions.gmProfileIds.filter((profileId): profileId is string => typeof profileId === "string")
          : [],
        ownerProfileId: typeof raw.permissions.ownerProfileId === "string" ? raw.permissions.ownerProfileId : undefined
      }
      : undefined,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined
  };
}

async function findUserByLegacyId(legacyId: string) {
  const rows = await db.select().from(users).where(eq(users.legacyId, legacyId)).limit(1);
  return rows[0] ?? null;
}

async function getOrCreateLegacyUser(input: {
  defaultPasswordHash: string;
  legacyId: string;
  username: string;
}): Promise<string> {
  const existing = await findUserByLegacyId(input.legacyId);

  if (existing) {
    return existing.id;
  }

  let username = sanitizeUsername(input.username) || "Player";
  let normalized = normalizeUsername(username);
  let suffix = 1;

  while ((await db.select().from(users).where(eq(users.usernameNormalized, normalized)).limit(1)).length > 0) {
    suffix += 1;
    username = `${sanitizeUsername(input.username) || "Player"} ${suffix}`;
    normalized = normalizeUsername(username);
  }

  const now = new Date();
  const rows = await db.insert(users).values({
    createdAt: now,
    id: randomUUID(),
    legacyId: input.legacyId,
    passwordHash: input.defaultPasswordHash,
    updatedAt: now,
    username,
    usernameNormalized: normalized
  }).returning({ id: users.id });

  return rows[0].id;
}

function remapTokenUserIds(content: SavedMapContent, profileIdToUserId: Map<string, string>): SavedMapContent {
  return {
    ...content,
    tokens: content.tokens
      .map((token) => {
        const userId = profileIdToUserId.get(token.profileId);
        return userId ? { ...token, profileId: userId } : null;
      })
      .filter((token): token is SavedMapContent["tokens"][number] => token !== null)
  };
}

async function importLegacyMap(input: {
  defaultPasswordHash: string;
  map: LegacyMap;
  profileIdToUserId: Map<string, string>;
}): Promise<void> {
  const ownerLegacyId = input.map.permissions?.ownerProfileId || "legacy-owner";
  const ownerUserId = input.profileIdToUserId.get(ownerLegacyId)
    ?? await getOrCreateLegacyUser({
      defaultPasswordHash: input.defaultPasswordHash,
      legacyId: ownerLegacyId,
      username: ownerLegacyId
    });
  input.profileIdToUserId.set(ownerLegacyId, ownerUserId);

  const existingRows = await db.select().from(workspaces).where(eq(workspaces.legacyId, input.map.id)).limit(1);
  const workspaceId = existingRows[0]?.id ?? randomUUID();
  const updatedAt = toDate(input.map.updatedAt);
  const content = remapTokenUserIds(parseSavedMapContent(input.map.content), input.profileIdToUserId);

  await db.transaction(async (tx) => {
    if (existingRows[0]) {
      await tx.update(workspaces)
        .set({
          name: input.map.name,
          ownerUserId,
          updatedAt
        })
        .where(eq(workspaces.id, workspaceId));
      await tx.delete(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId));
    } else {
      await tx.insert(workspaces).values({
        createdAt: updatedAt,
        id: workspaceId,
        legacyId: input.map.id,
        name: input.map.name,
        nextSequence: 1,
        ownerUserId,
        settings: {},
        updatedAt
      });
    }

    await tx.insert(workspaceMembers).values({
      role: "owner",
      userId: ownerUserId,
      workspaceId
    });

    const gmUserIds = new Set<string>();

    for (const gmLegacyId of input.map.permissions?.gmProfileIds ?? []) {
      const gmUserId = input.profileIdToUserId.get(gmLegacyId)
        ?? await getOrCreateLegacyUser({
          defaultPasswordHash: input.defaultPasswordHash,
          legacyId: gmLegacyId,
          username: gmLegacyId
        });
      input.profileIdToUserId.set(gmLegacyId, gmUserId);

      if (gmUserId !== ownerUserId) {
        gmUserIds.add(gmUserId);
      }
    }

    if (gmUserIds.size > 0) {
      await tx.insert(workspaceMembers).values(Array.from(gmUserIds, (userId) => ({
        role: "gm",
        userId,
        workspaceId
      })));
    }

    await replaceWorkspaceContent(workspaceId, content, tx);
  });
}

export async function importLegacyJsonData(options = parseArgs()): Promise<void> {
  await runDatabaseMigrations();
  const defaultPasswordHash = await hashPassword(options.defaultPassword);
  const profileIdToUserId = new Map<string, string>();
  const profiles = await readJsonFiles(path.join(options.dataDir, "profiles"), parseLegacyProfile);

  for (const profile of profiles) {
    profileIdToUserId.set(profile.id, await getOrCreateLegacyUser({
      defaultPasswordHash,
      legacyId: profile.id,
      username: profile.username
    }));
  }

  const maps = await readJsonFiles(path.join(options.dataDir, "maps"), parseLegacyMap);

  for (const map of maps) {
    await importLegacyMap({
      defaultPasswordHash,
      map,
      profileIdToUserId
    });
  }

  console.info(`[jsonImport] imported ${profiles.length} profiles and ${maps.length} maps.`);
}

if (process.argv[1]?.endsWith("jsonImport.js")) {
  importLegacyJsonData().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
