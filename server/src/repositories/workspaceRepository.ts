import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  users,
  workspaceMembers,
  workspaces,
  workspaceMemberTokens,
  maps,
} from "../db/schema.js";
import {
  findUserByNormalizedUsername,
  normalizeUsername,
  sanitizeUsername,
} from "./userRepository.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../errors.js";
import type { SavedMapContent } from "../../../src/core/protocol/index.js";
import {
  defaultWorkspaceTokenColor,
  type UserId,
  type WorkspaceMemberRecord,
  type WorkspaceRole,
  type WorkspaceTokenMemberRecord,
} from "../../../src/core/auth/authTypes.js";

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
  tokenMembers: WorkspaceTokenMemberRecord[];
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

export function toRole(role: string | null | undefined): WorkspaceRole | null {
  if (role === "owner" || role === "gm" || role === "player") {
    return role;
  }

  return null;
}

function toWorkspaceSummary(
  workspace: typeof workspaces.$inferSelect,
  role: WorkspaceRole,
): WorkspaceSummary {
  return {
    currentUserRole: role,
    id: workspace.id,
    name: workspace.name,
    ownerUserId: workspace.ownerUserId,
    updatedAt: workspace.updatedAt.toISOString(),
  };
}

export function toMapSummary(
  map: typeof maps.$inferSelect,
): WorkspaceMapSummary {
  return {
    id: map.id,
    name: map.name,
    updatedAt: map.updatedAt.toISOString(),
    workspaceId: map.workspaceId ?? map.id,
  };
}

export function canOpenAsGm(role: WorkspaceRole | null): boolean {
  return role === "owner" || role === "gm";
}

function isMutableWorkspaceRole(role: unknown): role is "gm" | "player" {
  return role === "gm" || role === "player";
}

function compareMembers(
  left: WorkspaceMemberRecord,
  right: WorkspaceMemberRecord,
): number {
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
  const rows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  return rows[0] ?? null;
}

export async function requireWorkspaceAndRole(
  workspaceId: string,
  userId: UserId,
): Promise<{
  role: WorkspaceRole;
  workspace: typeof workspaces.$inferSelect;
}> {
  const workspace = await getWorkspaceRow(workspaceId);

  if (!workspace) {
    throw new NotFoundError("Workspace not found.");
  }

  const role = await getWorkspaceRole(workspaceId, userId);

  if (!role) {
    throw new NotFoundError("Workspace not found.");
  }

  return { role, workspace };
}

export async function getWorkspaceRole(
  workspaceId: string,
  userId: UserId,
): Promise<WorkspaceRole | null> {
  const rows = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    )
    .limit(1);

  return toRole(rows[0]?.role);
}

export async function listWorkspacesForUser(
  userId: UserId,
): Promise<WorkspaceSummary[]> {
  const rows = await db
    .select({
      role: workspaceMembers.role,
      workspace: workspaces,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(desc(workspaces.updatedAt));

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

export async function getWorkspaceSummary(
  workspaceId: string,
  userId: UserId,
): Promise<WorkspaceSummary | null> {
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
}): Promise<{
  currentUserRole: WorkspaceRole;
  maps: WorkspaceMapSummary[];
  workspace: WorkspaceSummary;
}> {
  const { role, workspace } = await requireWorkspaceAndRole(
    input.workspaceId,
    input.userId,
  );
  const mapRows = await db
    .select()
    .from(maps)
    .where(eq(maps.workspaceId, input.workspaceId))
    .orderBy(desc(maps.updatedAt));

  return {
    currentUserRole: role,
    maps: mapRows.map(toMapSummary),
    workspace: toWorkspaceSummary(workspace, role),
  };
}

export async function createWorkspace(input: {
  name: string;
  ownerUserId: UserId;
}): Promise<WorkspaceSummary> {
  const now = new Date();
  const workspaceId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(workspaces).values({
      createdAt: now,
      id: workspaceId,
      name: input.name,
      ownerUserId: input.ownerUserId,
      updatedAt: now,
    });
    await tx.insert(workspaceMembers).values({
      role: "owner",
      userId: input.ownerUserId,
      workspaceId,
    });
    await tx.insert(workspaceMemberTokens).values({
      color: defaultWorkspaceTokenColor,
      updatedAt: now,
      userId: input.ownerUserId,
      workspaceId,
    });
  });

  const created = await getWorkspaceSummary(workspaceId, input.ownerUserId);

  if (!created) {
    throw new NotFoundError("Could not create workspace.");
  }

  return created;
}

export async function renameWorkspace(
  workspaceId: string,
  name: string,
): Promise<void> {
  await db
    .update(workspaces)
    .set({ name, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId));
}

export async function deleteWorkspace(workspaceId: string): Promise<boolean> {
  const deleted = await db
    .delete(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .returning({ id: workspaces.id });

  return deleted.length > 0;
}

export async function touchWorkspaceUpdatedAt(
  workspaceId: string,
): Promise<void> {
  await db
    .update(workspaces)
    .set({ updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId));
}

export async function listWorkspaceMembers(input: {
  actorUserId: UserId;
  workspaceId: string;
}): Promise<WorkspaceMembersView> {
  const { role, workspace } = await requireWorkspaceAndRole(
    input.workspaceId,
    input.actorUserId,
  );
  const rows = await db
    .select({
      role: workspaceMembers.role,
      userId: users.id,
      username: users.username,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, input.workspaceId))
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
        username: row.username,
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
    workspaceName: workspace.name,
  };
}

export async function addWorkspaceMemberByUsername(input: {
  actorUserId: UserId;
  role: WorkspaceRole;
  username: unknown;
  workspaceId: string;
}): Promise<void> {
  const { role: actorRole, workspace } = await requireWorkspaceAndRole(
    input.workspaceId,
    input.actorUserId,
  );

  if (actorRole !== "owner") {
    throw new ForbiddenError("Owner access denied.");
  }

  if (!isMutableWorkspaceRole(input.role)) {
    throw new BadRequestError("Invalid workspace role.");
  }

  const username = sanitizeUsername(input.username);

  if (!username) {
    throw new BadRequestError("Username is required.");
  }

  const user = await findUserByNormalizedUsername(normalizeUsername(username));

  if (!user) {
    throw new NotFoundError("User not found.");
  }

  const existingRows = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, user.id),
      ),
    )
    .limit(1);

  if (existingRows.length > 0) {
    throw new ConflictError("User is already in this workspace.");
  }

  await db.insert(workspaceMembers).values({
    role: user.id === workspace.ownerUserId ? "owner" : input.role,
    userId: user.id,
    workspaceId: input.workspaceId,
  });

  await db
    .insert(workspaceMemberTokens)
    .values({
      color: defaultWorkspaceTokenColor,
      updatedAt: new Date(),
      userId: user.id,
      workspaceId: input.workspaceId,
    })
    .onConflictDoNothing();

  await touchWorkspaceUpdatedAt(input.workspaceId);
}

export async function removeWorkspaceMember(input: {
  actorUserId: UserId;
  targetUserId: UserId;
  workspaceId: string;
}): Promise<void> {
  const { role: actorRole, workspace } = await requireWorkspaceAndRole(
    input.workspaceId,
    input.actorUserId,
  );

  if (actorRole !== "owner") {
    throw new ForbiddenError("Owner access denied.");
  }

  if (input.targetUserId === workspace.ownerUserId) {
    throw new ConflictError("Cannot remove the workspace owner.");
  }

  const deleted = await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.targetUserId),
      ),
    )
    .returning({ userId: workspaceMembers.userId });

  if (deleted.length === 0) {
    throw new NotFoundError("Workspace member not found.");
  }

  await db
    .delete(workspaceMemberTokens)
    .where(
      and(
        eq(workspaceMemberTokens.workspaceId, input.workspaceId),
        eq(workspaceMemberTokens.userId, input.targetUserId),
      ),
    );

  await touchWorkspaceUpdatedAt(input.workspaceId);
}

export async function updateWorkspaceMemberRole(input: {
  actorUserId: UserId;
  role: WorkspaceRole;
  targetUserId: UserId;
  workspaceId: string;
}): Promise<void> {
  const { role: actorRole, workspace } = await requireWorkspaceAndRole(
    input.workspaceId,
    input.actorUserId,
  );

  if (actorRole !== "owner") {
    throw new ForbiddenError("Owner access denied.");
  }

  if (!isMutableWorkspaceRole(input.role)) {
    throw new BadRequestError("Invalid workspace role.");
  }

  if (input.targetUserId === workspace.ownerUserId) {
    throw new ConflictError("Cannot change the workspace owner role.");
  }

  const updated = await db
    .update(workspaceMembers)
    .set({ role: input.role })
    .where(
      and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.targetUserId),
      ),
    )
    .returning({ userId: workspaceMembers.userId });

  if (updated.length === 0) {
    throw new NotFoundError("Workspace member not found.");
  }

  await touchWorkspaceUpdatedAt(input.workspaceId);
}
