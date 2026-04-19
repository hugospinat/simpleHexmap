import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { sessions, users } from "../db/schema.js";
import type { DbUser } from "./userRepository.js";

export const sessionDurationMs = 1000 * 60 * 60 * 24 * 30;

export type DbSession = typeof sessions.$inferSelect;

export async function createSession(input: {
  tokenHash: string;
  userId: string;
}): Promise<DbSession> {
  const now = new Date();
  const rows = await db.insert(sessions).values({
    id: randomUUID(),
    userId: input.userId,
    tokenHash: input.tokenHash,
    createdAt: now,
    expiresAt: new Date(now.getTime() + sessionDurationMs),
    lastSeenAt: now,
    revokedAt: null
  }).returning();

  return rows[0];
}

export async function findActiveSessionByTokenHash(tokenHash: string): Promise<{
  session: DbSession;
  user: DbUser;
} | null> {
  const now = new Date();
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(
      eq(sessions.tokenHash, tokenHash),
      isNull(sessions.revokedAt),
      gt(sessions.expiresAt, now)
    ))
    .limit(1);

  return rows[0] ?? null;
}

export async function touchSession(sessionId: string): Promise<void> {
  await db.update(sessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}
