import { randomUUID } from "node:crypto";
import { and, eq, gt, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db } from "../db/client.js";
import { sessions, users } from "../db/schema.js";
import type { DbUser } from "./userRepository.js";
import { serverLimits } from "../serverConfig.js";

export const sessionDurationMs = serverLimits.sessionLifetimeMs;
export const sessionIdleTimeoutMs = serverLimits.sessionIdleTimeoutMs;

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
  const idleCutoff = new Date(now.getTime() - sessionIdleTimeoutMs);
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(
      eq(sessions.tokenHash, tokenHash),
      isNull(sessions.revokedAt),
      gt(sessions.expiresAt, now),
      gt(sessions.lastSeenAt, idleCutoff),
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

export async function revokeActiveSessionsForUser(userId: string): Promise<void> {
  await db.update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(sessions.userId, userId),
      isNull(sessions.revokedAt),
    ));
}

export async function deleteExpiredSessions(now = new Date()): Promise<void> {
  const idleCutoff = new Date(now.getTime() - sessionIdleTimeoutMs);

  await db.delete(sessions).where(
    or(
      lt(sessions.expiresAt, now),
      lt(sessions.lastSeenAt, idleCutoff),
      isNotNull(sessions.revokedAt),
    ),
  );
}
