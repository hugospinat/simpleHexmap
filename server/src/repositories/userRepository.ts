import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import type { UserRecord } from "../../../src/core/auth/authTypes.js";

export type DbUser = typeof users.$inferSelect;

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function sanitizeUsername(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").slice(0, 32);
}

export function toUserRecord(user: DbUser): UserRecord {
  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

export async function findUserById(userId: string): Promise<DbUser | null> {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0] ?? null;
}

export async function findUserByNormalizedUsername(usernameNormalized: string): Promise<DbUser | null> {
  const rows = await db.select().from(users).where(eq(users.usernameNormalized, usernameNormalized)).limit(1);
  return rows[0] ?? null;
}

export async function createUser(input: {
  passwordHash: string;
  username: string;
}): Promise<DbUser> {
  const now = new Date();
  const rows = await db.insert(users).values({
    id: randomUUID(),
    legacyId: null,
    username: input.username,
    usernameNormalized: normalizeUsername(input.username),
    passwordHash: input.passwordHash,
    createdAt: now,
    updatedAt: now
  }).returning();

  return rows[0];
}
