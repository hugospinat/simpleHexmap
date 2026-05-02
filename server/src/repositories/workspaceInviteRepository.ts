import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  workspaces,
  workspaceInvites,
  workspaceMembers,
} from "../db/schema.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../errors.js";
import {
  defaultWorkspaceTokenColor,
  type UserId,
  type WorkspaceInviteRole,
  type WorkspaceInviteSummary,
  type WorkspaceRole,
} from "../../../src/core/auth/authTypes.js";
import {
  requireWorkspaceAndRole,
  toWorkspaceSummary,
  touchWorkspaceUpdatedAt,
  type WorkspaceSummary,
} from "./workspaceRepository.js";
import { serverLimits } from "../serverConfig.js";

type InviteRow = typeof workspaceInvites.$inferSelect;

function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toInviteSummary(
  invite: InviteRow,
  workspaceName: string,
): WorkspaceInviteSummary {
  return {
    createdAt: invite.createdAt.toISOString(),
    expiresAt: invite.expiresAt.toISOString(),
    id: invite.id,
    maxUses: invite.maxUses,
    revokedAt: invite.revokedAt ? invite.revokedAt.toISOString() : null,
    role: invite.role === "player" ? "player" : "player",
    usedCount: invite.usedCount,
    workspaceId: invite.workspaceId,
    workspaceName,
  };
}

function assertOwnerRole(role: WorkspaceRole): void {
  if (role !== "owner") {
    throw new ForbiddenError("Owner access denied.");
  }
}

function assertInviteRole(role: WorkspaceInviteRole): void {
  if (role !== "player") {
    throw new BadRequestError("Invalid workspace invite role.");
  }
}

function assertInvitePolicy(maxUses: number, expiresInDays: number): void {
  if (maxUses < 1 || maxUses > serverLimits.workspaceInviteMaxUses) {
    throw new BadRequestError("Invalid workspace invite max uses.");
  }

  if (
    expiresInDays < 1
    || expiresInDays > serverLimits.workspaceInviteMaxExpiresDays
  ) {
    throw new BadRequestError("Invalid workspace invite expiration.");
  }
}

function createInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

async function getInviteRowByToken(token: string) {
  const rows = await db
    .select({
      invite: workspaceInvites,
      workspaceName: workspaces.name,
    })
    .from(workspaceInvites)
    .innerJoin(workspaces, eq(workspaceInvites.workspaceId, workspaces.id))
    .where(eq(workspaceInvites.tokenHash, hashInviteToken(token)))
    .limit(1);

  return rows[0] ?? null;
}

function assertInviteIsUsable(invite: InviteRow): void {
  const now = new Date();

  if (invite.revokedAt) {
    throw new ConflictError("Invite link has been revoked.");
  }

  if (invite.expiresAt <= now) {
    throw new ConflictError("Invite link has expired.");
  }

  if (invite.usedCount >= invite.maxUses) {
    throw new ConflictError("Invite link has reached its usage limit.");
  }
}

export async function listWorkspaceInvites(input: {
  actorUserId: UserId;
  workspaceId: string;
}): Promise<WorkspaceInviteSummary[]> {
  const { role, workspace } = await requireWorkspaceAndRole(
    input.workspaceId,
    input.actorUserId,
  );
  assertOwnerRole(role);

  const rows = await db
    .select({ invite: workspaceInvites })
    .from(workspaceInvites)
    .where(eq(workspaceInvites.workspaceId, input.workspaceId))
    .orderBy(desc(workspaceInvites.createdAt));

  return rows.map((row) => toInviteSummary(row.invite, workspace.name));
}

export async function createWorkspaceInvite(input: {
  actorUserId: UserId;
  expiresInDays?: number;
  maxUses?: number;
  role?: WorkspaceInviteRole;
  workspaceId: string;
}): Promise<{ invite: WorkspaceInviteSummary; token: string }> {
  const { role: actorRole, workspace } = await requireWorkspaceAndRole(
    input.workspaceId,
    input.actorUserId,
  );
  assertOwnerRole(actorRole);

  const inviteRole = input.role ?? "player";
  const expiresInDays = input.expiresInDays
    ?? serverLimits.workspaceInviteDefaultExpiresDays;
  const maxUses = input.maxUses ?? serverLimits.workspaceInviteDefaultMaxUses;
  assertInviteRole(inviteRole);
  assertInvitePolicy(maxUses, expiresInDays);

  const token = createInviteToken();
  const now = new Date();
  const inviteId = randomUUID();
  const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60_000);

  await db.insert(workspaceInvites).values({
    createdAt: now,
    createdByUserId: input.actorUserId,
    expiresAt,
    id: inviteId,
    maxUses,
    role: inviteRole,
    tokenHash: hashInviteToken(token),
    updatedAt: now,
    usedCount: 0,
    workspaceId: input.workspaceId,
  });
  await touchWorkspaceUpdatedAt(input.workspaceId);

  console.info("[workspace_invites] created", {
    inviteId,
    workspaceId: input.workspaceId,
  });

  return {
    invite: toInviteSummary({
      createdAt: now,
      createdByUserId: input.actorUserId,
      expiresAt,
      id: inviteId,
      maxUses,
      revokedAt: null,
      role: inviteRole,
      tokenHash: hashInviteToken(token),
      updatedAt: now,
      usedCount: 0,
      workspaceId: input.workspaceId,
    }, workspace.name),
    token,
  };
}

export async function revokeWorkspaceInvite(input: {
  actorUserId: UserId;
  inviteId: string;
  workspaceId: string;
}): Promise<void> {
  const { role } = await requireWorkspaceAndRole(
    input.workspaceId,
    input.actorUserId,
  );
  assertOwnerRole(role);

  const revoked = await db
    .update(workspaceInvites)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(workspaceInvites.id, input.inviteId),
        eq(workspaceInvites.workspaceId, input.workspaceId),
        isNull(workspaceInvites.revokedAt),
      ),
    )
    .returning({ id: workspaceInvites.id });

  if (revoked.length === 0) {
    throw new NotFoundError("Workspace invite not found.");
  }

  await touchWorkspaceUpdatedAt(input.workspaceId);

  console.info("[workspace_invites] revoked", {
    inviteId: input.inviteId,
    workspaceId: input.workspaceId,
  });
}

export async function getWorkspaceInviteByToken(
  token: string,
): Promise<WorkspaceInviteSummary> {
  const row = await getInviteRowByToken(token);

  if (!row) {
    throw new NotFoundError("Invite link not found.");
  }

  assertInviteIsUsable(row.invite);
  return toInviteSummary(row.invite, row.workspaceName);
}

export async function joinWorkspaceByInviteToken(input: {
  token: string;
  userId: UserId;
}): Promise<{
  alreadyMember: boolean;
  workspace: WorkspaceSummary;
}> {
  const inviteRow = await getInviteRowByToken(input.token);

  if (!inviteRow) {
    throw new NotFoundError("Invite link not found.");
  }

  assertInviteIsUsable(inviteRow.invite);

  const result = await db.transaction(async (tx) => {
    const workspaceMembership = await tx
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, inviteRow.invite.workspaceId),
          eq(workspaceMembers.userId, input.userId),
        ),
      )
      .limit(1);

    if (workspaceMembership[0]?.role) {
      return { alreadyMember: true };
    }

    const activeInviteRows = await tx
      .select()
      .from(workspaceInvites)
      .where(eq(workspaceInvites.id, inviteRow.invite.id))
      .limit(1);
    const activeInvite = activeInviteRows[0];

    if (!activeInvite) {
      throw new NotFoundError("Invite link not found.");
    }

    assertInviteIsUsable(activeInvite);

    const now = new Date();
    await tx.insert(workspaceMembers).values({
      createdAt: now,
      role: "player",
      tokenColor: defaultWorkspaceTokenColor,
      updatedAt: now,
      userId: input.userId,
      workspaceId: inviteRow.invite.workspaceId,
    });
    await tx
      .update(workspaceInvites)
      .set({
        updatedAt: now,
        usedCount: activeInvite.usedCount + 1,
      })
      .where(eq(workspaceInvites.id, activeInvite.id));

    return { alreadyMember: false };
  });

  await touchWorkspaceUpdatedAt(inviteRow.invite.workspaceId);
  const { role, workspace } = await requireWorkspaceAndRole(
    inviteRow.invite.workspaceId,
    input.userId,
  );

  console.info("[workspace_invites] joined", {
    alreadyMember: result.alreadyMember,
    userId: input.userId,
    workspaceId: inviteRow.invite.workspaceId,
  });

  return {
    alreadyMember: result.alreadyMember,
    workspace: toWorkspaceSummary(workspace, role),
  };
}
