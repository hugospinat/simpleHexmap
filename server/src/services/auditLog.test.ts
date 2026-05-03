import { afterEach, describe, expect, it, vi } from "vitest";
import {
  logAuthFailureAudit,
  logMapDeletedAudit,
  logWorkspaceInviteCreatedAudit,
  logWorkspaceInviteJoinedAudit,
  logWorkspaceInviteRevokedAudit,
} from "./auditLog.js";

describe("auditLog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits auth failures as warning audit records", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const record = logAuthFailureAudit({
      action: "login",
      ip: "127.0.0.1",
      reason: "invalid_credentials",
      username: "alice",
    });

    expect(record).toMatchObject({
      action: "login",
      event: "auth_failure",
      ip: "127.0.0.1",
      reason: "invalid_credentials",
      timestamp: expect.any(String),
      username: "alice",
    });
    expect(warnSpy).toHaveBeenCalledWith("[audit]", record);
  });

  it("emits workspace invite lifecycle records as info audit logs", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const created = logWorkspaceInviteCreatedAudit({
      actorUserId: "owner-1",
      expiresAt: "2026-05-10T00:00:00.000Z",
      inviteId: "invite-1",
      maxUses: 3,
      role: "player",
      workspaceId: "workspace-1",
    });
    const revoked = logWorkspaceInviteRevokedAudit({
      actorUserId: "owner-1",
      inviteId: "invite-1",
      workspaceId: "workspace-1",
    });
    const joined = logWorkspaceInviteJoinedAudit({
      alreadyMember: false,
      inviteId: "invite-1",
      userId: "user-2",
      workspaceId: "workspace-1",
    });

    expect(created).toMatchObject({
      actorUserId: "owner-1",
      event: "workspace_invite_created",
      expiresAt: "2026-05-10T00:00:00.000Z",
      inviteId: "invite-1",
      maxUses: 3,
      role: "player",
      timestamp: expect.any(String),
      workspaceId: "workspace-1",
    });
    expect(revoked).toMatchObject({
      actorUserId: "owner-1",
      event: "workspace_invite_revoked",
      inviteId: "invite-1",
      timestamp: expect.any(String),
      workspaceId: "workspace-1",
    });
    expect(joined).toMatchObject({
      alreadyMember: false,
      event: "workspace_invite_joined",
      inviteId: "invite-1",
      timestamp: expect.any(String),
      userId: "user-2",
      workspaceId: "workspace-1",
    });
    expect(infoSpy).toHaveBeenNthCalledWith(1, "[audit]", created);
    expect(infoSpy).toHaveBeenNthCalledWith(2, "[audit]", revoked);
    expect(infoSpy).toHaveBeenNthCalledWith(3, "[audit]", joined);
  });

  it("emits map deletion records as info audit logs", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const record = logMapDeletedAudit({
      actorUserId: "gm-1",
      mapId: "map-1",
      mapName: "Ancient Ruins",
      workspaceId: "workspace-1",
    });

    expect(record).toMatchObject({
      actorUserId: "gm-1",
      event: "map_deleted",
      mapId: "map-1",
      mapName: "Ancient Ruins",
      timestamp: expect.any(String),
      workspaceId: "workspace-1",
    });
    expect(infoSpy).toHaveBeenCalledWith("[audit]", record);
  });
});
