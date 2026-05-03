import type { WorkspaceInviteRole } from "../../../src/core/auth/authTypes.js";

export type AuthFailureAuditRecord = {
  action: "login" | "signup";
  event: "auth_failure";
  ip: string;
  reason: "invalid_credentials" | "rate_limited";
  retryAfterMs?: number;
  timestamp: string;
  username: string;
};

export type WorkspaceInviteCreatedAuditRecord = {
  actorUserId: string;
  event: "workspace_invite_created";
  expiresAt: string;
  inviteId: string;
  maxUses: number;
  role: WorkspaceInviteRole;
  timestamp: string;
  workspaceId: string;
};

export type WorkspaceInviteRevokedAuditRecord = {
  actorUserId: string;
  event: "workspace_invite_revoked";
  inviteId: string;
  timestamp: string;
  workspaceId: string;
};

export type WorkspaceInviteJoinedAuditRecord = {
  alreadyMember: boolean;
  event: "workspace_invite_joined";
  inviteId: string;
  timestamp: string;
  userId: string;
  workspaceId: string;
};

export type MapDeletedAuditRecord = {
  actorUserId: string;
  event: "map_deleted";
  mapId: string;
  mapName: string;
  timestamp: string;
  workspaceId: string;
};

export type AuditRecord =
  | AuthFailureAuditRecord
  | WorkspaceInviteCreatedAuditRecord
  | WorkspaceInviteRevokedAuditRecord
  | WorkspaceInviteJoinedAuditRecord
  | MapDeletedAuditRecord;

function writeAuditRecord<T extends AuditRecord>(
  level: "info" | "warn",
  record: Omit<T, "timestamp">,
): T {
  const payload = {
    ...record,
    timestamp: new Date().toISOString(),
  } as T;
  console[level]("[audit]", payload);
  return payload;
}

export function logAuthFailureAudit(
  record: Omit<AuthFailureAuditRecord, "event" | "timestamp">,
): AuthFailureAuditRecord {
  return writeAuditRecord("warn", {
    ...record,
    event: "auth_failure",
  });
}

export function logWorkspaceInviteCreatedAudit(
  record: Omit<WorkspaceInviteCreatedAuditRecord, "event" | "timestamp">,
): WorkspaceInviteCreatedAuditRecord {
  return writeAuditRecord("info", {
    ...record,
    event: "workspace_invite_created",
  });
}

export function logWorkspaceInviteRevokedAudit(
  record: Omit<WorkspaceInviteRevokedAuditRecord, "event" | "timestamp">,
): WorkspaceInviteRevokedAuditRecord {
  return writeAuditRecord("info", {
    ...record,
    event: "workspace_invite_revoked",
  });
}

export function logWorkspaceInviteJoinedAudit(
  record: Omit<WorkspaceInviteJoinedAuditRecord, "event" | "timestamp">,
): WorkspaceInviteJoinedAuditRecord {
  return writeAuditRecord("info", {
    ...record,
    event: "workspace_invite_joined",
  });
}

export function logMapDeletedAudit(
  record: Omit<MapDeletedAuditRecord, "event" | "timestamp">,
): MapDeletedAuditRecord {
  return writeAuditRecord("info", {
    ...record,
    event: "map_deleted",
  });
}
