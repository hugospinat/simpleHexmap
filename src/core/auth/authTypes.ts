export type UserId = string;

export type UserRecord = {
  id: UserId;
  username: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceRole = "owner" | "gm" | "player";
export type MapOpenMode = "gm" | "player";

export type WorkspaceMemberRecord = {
  isOwner: boolean;
  role: WorkspaceRole;
  userId: UserId;
  username: string;
};

export type WorkspaceAccess = {
  ownerUserId: UserId;
  currentUserRole: WorkspaceRole;
};

export function canOpenWorkspaceAsGM(access: WorkspaceAccess): boolean {
  return access.currentUserRole === "owner" || access.currentUserRole === "gm";
}

export function canManageWorkspace(access: WorkspaceAccess): boolean {
  return access.currentUserRole === "owner";
}
