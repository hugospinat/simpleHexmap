import type { MapState } from "@/core/map/world";
import type { MapDocument } from "@/core/protocol";
import type {
  MapOpenMode,
  UserRecord,
  WorkspaceInviteSummary,
  WorkspaceMember,
} from "@/core/auth/authTypes";
import type {
  WorkspaceInviteLookup,
  WorkspaceMapSummary,
  WorkspaceSummary,
} from "@/app/api";

export type OpenMapState = {
  id: string;
  name: string;
  role: MapOpenMode;
  workspaceMembers: WorkspaceMember[];
  tokenPlacements: { userId: string; q: number; r: number }[];
  updatedAt: string;
  workspaceId: string;
  document: MapDocument;
  world: MapState;
};

export type ManagedWorkspaceState = {
  workspaceId: string | null;
  invites: WorkspaceInviteSummary[];
  maps: WorkspaceMapSummary[];
  members: WorkspaceMember[];
};

export type AppScreenState = {
  errorMessage: string | null;
  inviteLookup: WorkspaceInviteLookup | null;
  isBusy: boolean;
  managedWorkspace: WorkspaceSummary | null;
  managedWorkspaceId: string | null;
  managedWorkspaceInvites: WorkspaceInviteSummary[];
  managedWorkspaceMaps: WorkspaceMapSummary[];
  managedWorkspaceMembers: WorkspaceMember[];
  openMap: OpenMapState | null;
  selectedWorkspaceId: string | null;
  user: UserRecord | null;
  workspaces: WorkspaceSummary[];
};
