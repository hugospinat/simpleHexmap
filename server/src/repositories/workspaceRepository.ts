import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { maps, users, workspaceMembers, workspaces } from "../db/schema.js";
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
import {
  defaultWorkspaceTokenColor,
  type UserId,
  type WorkspaceMember,
  type WorkspaceRole,
} from "../../../src/core/auth/authTypes.js";
import type {
  MapDocument,
  MapTokenPlacement,
} from "../../../src/core/protocol/index.js";

export type WorkspaceSummary = {
  currentUserRole: WorkspaceRole;
  id: string;
  name: string;
  updatedAt: string;
};

export type WorkspaceMapSummary = {
  id: string;
  name: string;
  updatedAt: string;
  workspaceId: string;
};

export type WorkspaceMapRecord = WorkspaceMapSummary & {
  currentUserRole: WorkspaceRole;
  document: MapDocument;
  nextSequence: number;
  tokenPlacements: MapTokenPlacement[];
  workspaceMembers: WorkspaceMember[];
  workspaceName: string;
};

export type WorkspaceMembersView = {
  currentUserRole: WorkspaceRole;
  members: WorkspaceMember[];
  updatedAt: string;
  workspaceId: string;
  workspaceName: string;
};

type WorkspaceRow = typeof workspaces.$inferSelect;

function roleRank(role: WorkspaceRole): number {
  if (role === "owner") return 0;
  if (role === "gm") return 1;
  return 2;
}

function compareMembers(left: WorkspaceMember, right: WorkspaceMember): number {
  if (left.role !== right.role) {
    return roleRank(left.role) - roleRank(right.role);
  }

  return left.username.localeCompare(right.username);
}

export function toRole(role: string | null | undefined): WorkspaceRole | null {
  if (role === "owner" || role === "gm" || role === "player") {
    return role;
  }

  return null;
}

export function toWorkspaceSummary(
  workspace: WorkspaceRow,
  role: WorkspaceRole,
): WorkspaceSummary {
  return {
    currentUserRole: role,
    id: workspace.id,
    name: workspace.name,
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
    workspaceId: map.workspaceId,
  };
}

export function canOpenAsGm(role: WorkspaceRole | null): boolean {
  return role === "owner" || role === "gm";
}

function isMutableWorkspaceRole(role: unknown): role is "gm" | "player" {
  return role === "gm" || role === "player";
}

async function getWorkspaceRow(
  workspaceId: string,
): Promise<WorkspaceRow | null> {
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
): Promise<{ role: WorkspaceRole; workspace: WorkspaceRow }> {
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
    .select({ role: workspaceMembers.role })
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

export async function listWorkspaceMembersForWorkspace(
  workspaceId: string,
): Promise<WorkspaceMember[]> {
  const rows = await db
    .select({
      role: workspaceMembers.role,
      tokenColor: workspaceMembers.tokenColor,
      userId: users.id,
      username: users.username,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(asc(users.username));

  return rows
    .map((row): WorkspaceMember | null => {
      const role = toRole(row.role);

      if (!role) {
        return null;
      }

      return {
        role,
        tokenColor: row.tokenColor,
        userId: row.userId,
        username: row.username,
      };
    })
    .filter((member): member is WorkspaceMember => member !== null)
    .sort(compareMembers);
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
    .filter((workspace): workspace is WorkspaceSummary => workspace !== null);
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
  creatorUserId: UserId;
  name: string;
}): Promise<WorkspaceSummary> {
  const now = new Date();
  const workspaceId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(workspaces).values({
      createdAt: now,
      id: workspaceId,
      name: input.name,
      updatedAt: now,
    });
    await tx.insert(workspaceMembers).values({
      createdAt: now,
      role: "owner",
      tokenColor: defaultWorkspaceTokenColor,
      updatedAt: now,
      userId: input.creatorUserId,
      workspaceId,
    });
  });

  const created = await getWorkspaceSummary(workspaceId, input.creatorUserId);

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

  return {
    currentUserRole: role,
    members: await listWorkspaceMembersForWorkspace(input.workspaceId),
    updatedAt: workspace.updatedAt.toISOString(),
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
  const { role: actorRole } = await requireWorkspaceAndRole(
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
    .select({ userId: workspaceMembers.userId })
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

  const now = new Date();
  await db.insert(workspaceMembers).values({
    createdAt: now,
    role: input.role,
    tokenColor: defaultWorkspaceTokenColor,
    updatedAt: now,
    userId: user.id,
    workspaceId: input.workspaceId,
  });

  await touchWorkspaceUpdatedAt(input.workspaceId);
}

export async function removeWorkspaceMember(input: {
  actorUserId: UserId;
  targetUserId: UserId;
  workspaceId: string;
}): Promise<void> {
  const { role: actorRole } = await requireWorkspaceAndRole(
    input.workspaceId,
    input.actorUserId,
  );

  if (actorRole !== "owner") {
    throw new ForbiddenError("Owner access denied.");
  }

  const targetRows = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.targetUserId),
      ),
    )
    .limit(1);
  const targetRole = toRole(targetRows[0]?.role);

  if (!targetRole) {
    throw new NotFoundError("Workspace member not found.");
  }

  if (targetRole === "owner") {
    throw new ConflictError("Cannot remove the workspace owner.");
  }

  await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.targetUserId),
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
  const { role: actorRole } = await requireWorkspaceAndRole(
    input.workspaceId,
    input.actorUserId,
  );

  if (actorRole !== "owner") {
    throw new ForbiddenError("Owner access denied.");
  }

  if (!isMutableWorkspaceRole(input.role)) {
    throw new BadRequestError("Invalid workspace role.");
  }

  const targetRows = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.targetUserId),
      ),
    )
    .limit(1);
  const targetRole = toRole(targetRows[0]?.role);

  if (!targetRole) {
    throw new NotFoundError("Workspace member not found.");
  }

  if (targetRole === "owner") {
    throw new ConflictError("Cannot change the workspace owner role.");
  }

  await db
    .update(workspaceMembers)
    .set({ role: input.role, updatedAt: new Date() })
    .where(
      and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.targetUserId),
      ),
    );

  await touchWorkspaceUpdatedAt(input.workspaceId);
}
