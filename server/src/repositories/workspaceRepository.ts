import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users, workspaceGroupMembers, workspaceGroups, workspaces } from "../db/schema.js";
import { materializeWorkspaceContent, replaceWorkspaceContent } from "./mapContentRepository.js";
import { findUserByNormalizedUsername, normalizeUsername, sanitizeUsername } from "./userRepository.js";
import type { SavedMapContent } from "../../../src/core/protocol/index.js";
import type { UserId, WorkspaceMemberRecord, WorkspaceRole } from "../../../src/core/auth/authTypes.js";

export type WorkspaceSummary = {
  currentUserRole: WorkspaceRole;
  id: string;
  name: string;
  ownerUserId: string;
  updatedAt: string;
};

export type WorkspaceMapSummary = {
  id: string;
  name: string;
  updatedAt: string;
  workspaceId: string;
};

export type WorkspaceMapRecord = WorkspaceMapSummary & {
  content: SavedMapContent;
  currentUserRole: WorkspaceRole;
  nextSequence: number;
  ownerUserId: string;
  workspaceName: string;
};

export type WorkspaceMembersView = {
  currentUserRole: WorkspaceRole;
  members: WorkspaceMemberRecord[];
  updatedAt: string;
  workspaceId: string;
  workspaceName: string;
  ownerUserId: string;
};

function toRole(role: string | null | undefined): WorkspaceRole | null {
  if (role === "owner" || role === "gm" || role === "player") {
    return role;
  }

  return null;
}

function toWorkspaceSummary(workspace: typeof workspaceGroups.$inferSelect, role: WorkspaceRole): WorkspaceSummary {
  return {
    currentUserRole: role,
    id: workspace.id,
    name: workspace.name,
    ownerUserId: workspace.ownerUserId,
    updatedAt: workspace.updatedAt.toISOString()
  };
}

function toMapSummary(map: typeof workspaces.$inferSelect): WorkspaceMapSummary {
  return {
    id: map.id,
    name: map.name,
    updatedAt: map.updatedAt.toISOString(),
    workspaceId: map.workspaceGroupId ?? map.id
  };
}

export function canOpenAsGm(role: WorkspaceRole | null): boolean {
  return role === "owner" || role === "gm";
}

function isMutableWorkspaceRole(role: unknown): role is "gm" | "player" {
  return role === "gm" || role === "player";
}

function compareMembers(left: WorkspaceMemberRecord, right: WorkspaceMemberRecord): number {
  if (left.isOwner !== right.isOwner) {
    return left.isOwner ? -1 : 1;
  }

  if (left.role !== right.role) {
    if (left.role === "gm") {
      return -1;
    }

    if (right.role === "gm") {
      return 1;
    }
  }

  return left.username.localeCompare(right.username);
}

async function getWorkspaceRow(workspaceId: string) {
  const rows = await db.select().from(workspaceGroups).where(eq(workspaceGroups.id, workspaceId)).limit(1);
  return rows[0] ?? null;
}

async function requireWorkspaceAndRole(workspaceId: string, userId: UserId): Promise<{
  role: WorkspaceRole;
  workspace: typeof workspaceGroups.$inferSelect;
}> {
  const workspace = await getWorkspaceRow(workspaceId);

  if (!workspace) {
    throw new Error("Workspace not found.");
  }

  const role = await getWorkspaceRole(workspaceId, userId);

  if (!role) {
    throw new Error("Workspace not found.");
  }

  return { role, workspace };
}

async function getMapRowsForUser(mapId: string, userId: UserId) {
  return db.select({
    map: workspaces,
    workspace: workspaceGroups,
    role: workspaceGroupMembers.role
  })
    .from(workspaces)
    .innerJoin(workspaceGroups, eq(workspaces.workspaceGroupId, workspaceGroups.id))
    .innerJoin(
      workspaceGroupMembers,
      and(
        eq(workspaceGroupMembers.workspaceGroupId, workspaceGroups.id),
        eq(workspaceGroupMembers.userId, userId)
      )
    )
    .where(eq(workspaces.id, mapId))
    .limit(1);
}

export async function getWorkspaceRole(workspaceId: string, userId: UserId): Promise<WorkspaceRole | null> {
  const rows = await db.select()
    .from(workspaceGroupMembers)
    .where(and(
      eq(workspaceGroupMembers.workspaceGroupId, workspaceId),
      eq(workspaceGroupMembers.userId, userId)
    ))
    .limit(1);

  return toRole(rows[0]?.role);
}

export async function listWorkspacesForUser(userId: UserId): Promise<WorkspaceSummary[]> {
  const rows = await db.select({
    role: workspaceGroupMembers.role,
    workspace: workspaceGroups
  })
    .from(workspaceGroupMembers)
    .innerJoin(workspaceGroups, eq(workspaceGroupMembers.workspaceGroupId, workspaceGroups.id))
    .where(eq(workspaceGroupMembers.userId, userId))
    .orderBy(desc(workspaceGroups.updatedAt));

  return rows
    .map((row) => {
      const role = toRole(row.role);

      if (!role) {
        return null;
      }

      return toWorkspaceSummary(row.workspace, role);
    })
    .filter((summary): summary is WorkspaceSummary => summary !== null);
}

export async function getWorkspaceSummary(workspaceId: string, userId: UserId): Promise<WorkspaceSummary | null> {
  const workspace = await getWorkspaceRow(workspaceId);

  if (!workspace) {
    return null;
  }

  const role = await getWorkspaceRole(workspaceId, userId);

  if (!role) {
    return null;
  }

  return toWorkspaceSummary(workspace, role);
}

export async function listWorkspaceMaps(input: {
  userId: UserId;
  workspaceId: string;
}): Promise<{ currentUserRole: WorkspaceRole; maps: WorkspaceMapSummary[]; workspace: WorkspaceSummary }> {
  const { role, workspace } = await requireWorkspaceAndRole(input.workspaceId, input.userId);
  const maps = await db.select().from(workspaces)
    .where(eq(workspaces.workspaceGroupId, input.workspaceId))
    .orderBy(desc(workspaces.updatedAt));

  return {
    currentUserRole: role,
    maps: maps.map(toMapSummary),
    workspace: toWorkspaceSummary(workspace, role)
  };
}

export async function getMapRoleForUser(mapId: string, userId: UserId): Promise<WorkspaceRole | null> {
  const rows = await getMapRowsForUser(mapId, userId);
  return toRole(rows[0]?.role);
}

export async function getMapRecordForUser(mapId: string, userId: UserId): Promise<WorkspaceMapRecord | null> {
  const rows = await getMapRowsForUser(mapId, userId);
  const row = rows[0];

  if (!row) {
    return null;
  }

  const role = toRole(row.role);

  if (!role) {
    return null;
  }

  return {
    ...toMapSummary(row.map),
    content: await materializeWorkspaceContent(row.map.id),
    currentUserRole: role,
    nextSequence: row.map.nextSequence,
    ownerUserId: row.workspace.ownerUserId,
    workspaceName: row.workspace.name
  };
}

export async function createWorkspace(input: {
  name: string;
  ownerUserId: UserId;
}): Promise<WorkspaceSummary> {
  const now = new Date();
  const workspaceId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(workspaceGroups).values({
      createdAt: now,
      id: workspaceId,
      name: input.name,
      ownerUserId: input.ownerUserId,
      updatedAt: now
    });
    await tx.insert(workspaceGroupMembers).values({
      role: "owner",
      userId: input.ownerUserId,
      workspaceGroupId: workspaceId
    });
  });

  const created = await getWorkspaceSummary(workspaceId, input.ownerUserId);

  if (!created) {
    throw new Error("Could not create workspace.");
  }

  return created;
}

export async function createMapInWorkspace(input: {
  actorUserId: UserId;
  content: SavedMapContent;
  name: string;
  workspaceId: string;
}): Promise<WorkspaceMapRecord> {
  const { role, workspace } = await requireWorkspaceAndRole(input.workspaceId, input.actorUserId);

  if (!canOpenAsGm(role)) {
    throw new Error("GM access denied.");
  }

  const now = new Date();
  const mapId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(workspaces).values({
      createdAt: now,
      id: mapId,
      legacyId: null,
      name: input.name,
      nextSequence: 1,
      ownerUserId: workspace.ownerUserId,
      settings: {},
      updatedAt: now,
      workspaceGroupId: input.workspaceId
    });
    await replaceWorkspaceContent(mapId, input.content, tx);
    await tx.update(workspaceGroups)
      .set({ updatedAt: now })
      .where(eq(workspaceGroups.id, input.workspaceId));
  });

  const created = await getMapRecordForUser(mapId, input.actorUserId);

  if (!created) {
    throw new Error("Could not create map.");
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
    throw new Error("Map not found.");
  }

  if (!canOpenAsGm(map.currentUserRole)) {
    throw new Error("GM access denied.");
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(workspaces)
      .set({
        name: input.name,
        updatedAt: now
      })
      .where(eq(workspaces.id, input.mapId));

    await tx.update(workspaceGroups)
      .set({ updatedAt: now })
      .where(eq(workspaceGroups.id, map.workspaceId));
  });

  const updated = await getMapRecordForUser(input.mapId, input.actorUserId);

  if (!updated) {
    throw new Error("Map not found.");
  }

  return updated;
}

export async function deleteWorkspaceMap(input: {
  actorUserId: UserId;
  mapId: string;
}): Promise<boolean> {
  const map = await getMapRecordForUser(input.mapId, input.actorUserId);

  if (!map) {
    throw new Error("Map not found.");
  }

  if (!canOpenAsGm(map.currentUserRole)) {
    throw new Error("GM access denied.");
  }

  const now = new Date();
  const deleted = await db.transaction(async (tx) => {
    const rows = await tx.delete(workspaces)
      .where(eq(workspaces.id, input.mapId))
      .returning({ id: workspaces.id });

    if (rows.length > 0) {
      await tx.update(workspaceGroups)
        .set({ updatedAt: now })
        .where(eq(workspaceGroups.id, map.workspaceId));
    }

    return rows;
  });

  return deleted.length > 0;
}

export async function renameWorkspace(workspaceId: string, name: string): Promise<void> {
  await db.update(workspaceGroups)
    .set({ name, updatedAt: new Date() })
    .where(eq(workspaceGroups.id, workspaceId));
}

export async function deleteWorkspace(workspaceId: string): Promise<boolean> {
  const deleted = await db.delete(workspaceGroups)
    .where(eq(workspaceGroups.id, workspaceId))
    .returning({ id: workspaceGroups.id });

  return deleted.length > 0;
}

export async function touchWorkspaceUpdatedAt(workspaceId: string): Promise<void> {
  await db.update(workspaceGroups)
    .set({ updatedAt: new Date() })
    .where(eq(workspaceGroups.id, workspaceId));
}

export async function getWorkspaceIdForMap(mapId: string): Promise<string | null> {
  const rows = await db.select({ workspaceGroupId: workspaces.workspaceGroupId })
    .from(workspaces)
    .where(eq(workspaces.id, mapId))
    .limit(1);

  return rows[0]?.workspaceGroupId ?? null;
}

export async function listWorkspaceMembers(input: {
  actorUserId: UserId;
  workspaceId: string;
}): Promise<WorkspaceMembersView> {
  const { role, workspace } = await requireWorkspaceAndRole(input.workspaceId, input.actorUserId);
  const rows = await db.select({
    role: workspaceGroupMembers.role,
    userId: users.id,
    username: users.username
  })
    .from(workspaceGroupMembers)
    .innerJoin(users, eq(workspaceGroupMembers.userId, users.id))
    .where(eq(workspaceGroupMembers.workspaceGroupId, input.workspaceId))
    .orderBy(asc(users.username));

  const members = rows
    .map((row): WorkspaceMemberRecord | null => {
      const mappedRole = toRole(row.role);

      if (!mappedRole) {
        return null;
      }

      return {
        isOwner: row.userId === workspace.ownerUserId,
        role: row.userId === workspace.ownerUserId ? "owner" : mappedRole,
        userId: row.userId,
        username: row.username
      };
    })
    .filter((member): member is WorkspaceMemberRecord => member !== null)
    .sort(compareMembers);

  return {
    currentUserRole: role,
    members,
    updatedAt: workspace.updatedAt.toISOString(),
    ownerUserId: workspace.ownerUserId,
    workspaceId: workspace.id,
    workspaceName: workspace.name
  };
}

export async function addWorkspaceMemberByUsername(input: {
  actorUserId: UserId;
  role: WorkspaceRole;
  username: unknown;
  workspaceId: string;
}): Promise<void> {
  const { role: actorRole, workspace } = await requireWorkspaceAndRole(input.workspaceId, input.actorUserId);

  if (actorRole !== "owner") {
    throw new Error("Owner access denied.");
  }

  if (!isMutableWorkspaceRole(input.role)) {
    throw new Error("Invalid workspace role.");
  }

  const username = sanitizeUsername(input.username);

  if (!username) {
    throw new Error("Username is required.");
  }

  const user = await findUserByNormalizedUsername(normalizeUsername(username));

  if (!user) {
    throw new Error("User not found.");
  }

  const existingRows = await db.select().from(workspaceGroupMembers)
    .where(and(
      eq(workspaceGroupMembers.workspaceGroupId, input.workspaceId),
      eq(workspaceGroupMembers.userId, user.id)
    ))
    .limit(1);

  if (existingRows.length > 0) {
    throw new Error("User is already in this workspace.");
  }

  await db.insert(workspaceGroupMembers).values({
    role: user.id === workspace.ownerUserId ? "owner" : input.role,
    userId: user.id,
    workspaceGroupId: input.workspaceId
  });

  await touchWorkspaceUpdatedAt(input.workspaceId);
}

export async function removeWorkspaceMember(input: {
  actorUserId: UserId;
  targetUserId: UserId;
  workspaceId: string;
}): Promise<void> {
  const { role: actorRole, workspace } = await requireWorkspaceAndRole(input.workspaceId, input.actorUserId);

  if (actorRole !== "owner") {
    throw new Error("Owner access denied.");
  }

  if (input.targetUserId === workspace.ownerUserId) {
    throw new Error("Cannot remove the workspace owner.");
  }

  const deleted = await db.delete(workspaceGroupMembers)
    .where(and(
      eq(workspaceGroupMembers.workspaceGroupId, input.workspaceId),
      eq(workspaceGroupMembers.userId, input.targetUserId)
    ))
    .returning({ userId: workspaceGroupMembers.userId });

  if (deleted.length === 0) {
    throw new Error("Workspace member not found.");
  }

  await touchWorkspaceUpdatedAt(input.workspaceId);
}

export async function updateWorkspaceMemberRole(input: {
  actorUserId: UserId;
  role: WorkspaceRole;
  targetUserId: UserId;
  workspaceId: string;
}): Promise<void> {
  const { role: actorRole, workspace } = await requireWorkspaceAndRole(input.workspaceId, input.actorUserId);

  if (actorRole !== "owner") {
    throw new Error("Owner access denied.");
  }

  if (!isMutableWorkspaceRole(input.role)) {
    throw new Error("Invalid workspace role.");
  }

  if (input.targetUserId === workspace.ownerUserId) {
    throw new Error("Cannot change the workspace owner role.");
  }

  const updated = await db.update(workspaceGroupMembers)
    .set({ role: input.role })
    .where(and(
      eq(workspaceGroupMembers.workspaceGroupId, input.workspaceId),
      eq(workspaceGroupMembers.userId, input.targetUserId)
    ))
    .returning({ userId: workspaceGroupMembers.userId });

  if (updated.length === 0) {
    throw new Error("Workspace member not found.");
  }

  await touchWorkspaceUpdatedAt(input.workspaceId);
}
