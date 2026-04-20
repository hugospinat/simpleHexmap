import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  users,
  workspaceMembers,
  workspaces,
  workspaceMemberTokens,
  maps,
} from "../db/schema.js";
import {
  materializeMapContent,
  replaceMapContent,
} from "./mapContentRepository.js";
import {
  canOpenAsGm,
  requireWorkspaceAndRole,
  toMapSummary,
  toRole,
  touchWorkspaceUpdatedAt,
  getWorkspaceRole,
  type WorkspaceMapRecord,
  type WorkspaceMapSummary,
} from "./workspaceRepository.js";
import type { SavedMapContent } from "../../../src/core/protocol/index.js";
import {
  defaultWorkspaceTokenColor,
  type UserId,
  type WorkspaceMemberRecord,
  type WorkspaceRole,
  type WorkspaceTokenMemberRecord,
} from "../../../src/core/auth/authTypes.js";
import { ForbiddenError, NotFoundError } from "../errors.js";

function compareMembers(
  left: WorkspaceMemberRecord,
  right: WorkspaceMemberRecord,
): number {
  if (left.isOwner !== right.isOwner) {
    return left.isOwner ? -1 : 1;
  }

  if (left.role !== right.role) {
    if (left.role === "gm") return -1;
    if (right.role === "gm") return 1;
  }

  return left.username.localeCompare(right.username);
}

async function getMapRowsForUser(mapId: string, userId: UserId) {
  return db
    .select({
      map: maps,
      workspace: workspaces,
      role: workspaceMembers.role,
    })
    .from(maps)
    .innerJoin(workspaces, eq(maps.workspaceId, workspaces.id))
    .innerJoin(
      workspaceMembers,
      and(
        eq(workspaceMembers.workspaceId, workspaces.id),
        eq(workspaceMembers.userId, userId),
      ),
    )
    .where(eq(maps.id, mapId))
    .limit(1);
}

async function listWorkspaceTokenMembers(
  workspaceId: string,
  ownerUserId: string,
): Promise<WorkspaceTokenMemberRecord[]> {
  const rows = await db
    .select({
      color: workspaceMemberTokens.color,
      role: workspaceMembers.role,
      userId: users.id,
      username: users.username,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .leftJoin(
      workspaceMemberTokens,
      and(
        eq(workspaceMemberTokens.workspaceId, workspaceMembers.workspaceId),
        eq(workspaceMemberTokens.userId, workspaceMembers.userId),
      ),
    )
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(asc(users.username));

  return rows
    .map((row): WorkspaceTokenMemberRecord | null => {
      const mappedRole = toRole(row.role);

      if (!mappedRole) return null;

      const isOwner = row.userId === ownerUserId;

      return {
        color: row.color ?? defaultWorkspaceTokenColor,
        isOwner,
        role: isOwner ? "owner" : mappedRole,
        userId: row.userId,
        username: row.username,
      };
    })
    .filter((member): member is WorkspaceTokenMemberRecord => member !== null)
    .sort(compareMembers);
}

export async function getMapRoleForUser(
  mapId: string,
  userId: UserId,
): Promise<WorkspaceRole | null> {
  const rows = await getMapRowsForUser(mapId, userId);
  return toRole(rows[0]?.role);
}

export async function getMapRecordForUser(
  mapId: string,
  userId: UserId,
): Promise<WorkspaceMapRecord | null> {
  const rows = await getMapRowsForUser(mapId, userId);
  const row = rows[0];

  if (!row) return null;

  const role = toRole(row.role);

  if (!role) return null;

  return {
    ...toMapSummary(row.map),
    content: await materializeMapContent(row.map.id),
    currentUserRole: role,
    nextSequence: row.map.nextSequence,
    ownerUserId: row.workspace.ownerUserId,
    tokenMembers: await listWorkspaceTokenMembers(
      row.workspace.id,
      row.workspace.ownerUserId,
    ),
    workspaceName: row.workspace.name,
  };
}

export async function createMapInWorkspace(input: {
  actorUserId: UserId;
  content: SavedMapContent;
  name: string;
  workspaceId: string;
}): Promise<WorkspaceMapRecord> {
  const { role, workspace } = await requireWorkspaceAndRole(
    input.workspaceId,
    input.actorUserId,
  );

  if (!canOpenAsGm(role)) {
    throw new ForbiddenError("GM access denied.");
  }

  const now = new Date();
  const mapId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(maps).values({
      createdAt: now,
      id: mapId,
      legacyId: null,
      name: input.name,
      nextSequence: 1,
      ownerUserId: workspace.ownerUserId,
      settings: {},
      updatedAt: now,
      workspaceId: input.workspaceId,
    });
    await replaceMapContent(mapId, input.content, tx);
    await tx
      .update(workspaces)
      .set({ updatedAt: now })
      .where(eq(workspaces.id, input.workspaceId));
  });

  const created = await getMapRecordForUser(mapId, input.actorUserId);

  if (!created) {
    throw new NotFoundError("Could not create map.");
  }

  return created;
}

export async function renameWorkspaceMap(input: {
  actorUserId: UserId;
  mapId: string;
  name: string;
}): Promise<WorkspaceMapRecord> {
  const map = await getMapRecordForUser(input.mapId, input.actorUserId);

  if (!map) {
    throw new NotFoundError("Map not found.");
  }

  if (!canOpenAsGm(map.currentUserRole)) {
    throw new ForbiddenError("GM access denied.");
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(maps)
      .set({ name: input.name, updatedAt: now })
      .where(eq(maps.id, input.mapId));

    await tx
      .update(workspaces)
      .set({ updatedAt: now })
      .where(eq(workspaces.id, map.workspaceId));
  });

  const updated = await getMapRecordForUser(input.mapId, input.actorUserId);

  if (!updated) {
    throw new NotFoundError("Map not found.");
  }

  return updated;
}

export async function deleteWorkspaceMap(input: {
  actorUserId: UserId;
  mapId: string;
}): Promise<boolean> {
  const map = await getMapRecordForUser(input.mapId, input.actorUserId);

  if (!map) {
    throw new NotFoundError("Map not found.");
  }

  if (!canOpenAsGm(map.currentUserRole)) {
    throw new ForbiddenError("GM access denied.");
  }

  const now = new Date();
  const deleted = await db.transaction(async (tx) => {
    const rows = await tx
      .delete(maps)
      .where(eq(maps.id, input.mapId))
      .returning({ id: maps.id });

    if (rows.length > 0) {
      await tx
        .update(workspaces)
        .set({ updatedAt: now })
        .where(eq(workspaces.id, map.workspaceId));
    }

    return rows;
  });

  return deleted.length > 0;
}

export async function getWorkspaceIdForMap(
  mapId: string,
): Promise<string | null> {
  const rows = await db
    .select({ workspaceId: maps.workspaceId })
    .from(maps)
    .where(eq(maps.id, mapId))
    .limit(1);

  return rows[0]?.workspaceId ?? null;
}
