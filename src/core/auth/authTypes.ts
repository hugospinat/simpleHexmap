export type UserId = string;

export type UserRecord = {
  id: UserId;
  username: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceRole = "owner" | "gm" | "player";
export type WorkspaceInviteRole = "player";
export type MapOpenMode = "gm" | "player";
export const defaultWorkspaceTokenColor = "#2f6fed";

export type WorkspaceMember = {
  role: WorkspaceRole;
  tokenColor: string;
  userId: UserId;
  username: string;
};

export type WorkspaceAccess = {
  currentUserRole: WorkspaceRole;
};

export type WorkspaceInviteSummary = {
  createdAt: string;
  expiresAt: string;
  id: string;
  maxUses: number;
  role: WorkspaceInviteRole;
  revokedAt: string | null;
  usedCount: number;
  workspaceId: string;
  workspaceName: string;
};

export function canOpenWorkspaceAsGM(access: WorkspaceAccess): boolean {
  return access.currentUserRole === "owner" || access.currentUserRole === "gm";
}

export function canManageWorkspace(access: WorkspaceAccess): boolean {
  return access.currentUserRole === "owner";
}
