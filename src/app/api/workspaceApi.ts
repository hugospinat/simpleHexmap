import { buildApiUrl } from "@/app/api/apiBase";
import { parseSavedMapContent } from "@/core/document/savedMapCodec";
import type { SavedMapContent } from "@/core/document/savedMapTypes";
import type {
  MapOpenMode,
  WorkspaceMemberRecord,
  WorkspaceRole,
  WorkspaceTokenMemberRecord
} from "@/core/auth/authTypes";

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
  ownerUserId: string;
  tokenMembers: WorkspaceTokenMemberRecord[];
  workspaceName: string;
};

export type WorkspaceMembersPayload = {
  members: WorkspaceMemberRecord[];
  workspace: WorkspaceSummary;
};

export type WorkspaceMapsPayload = {
  currentUserRole: WorkspaceRole;
  maps: WorkspaceMapSummary[];
  workspace: WorkspaceSummary;
};

type CreateWorkspaceInput = {
  name: string;
};

type CreateWorkspaceMapInput = {
  content?: SavedMapContent;
  name: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(buildApiUrl(path), {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const payload = await response.json() as unknown;

  if (!response.ok) {
    const errorMessage = isObject(payload) && typeof payload.error === "string"
      ? payload.error
      : `Request failed with status ${response.status}.`;
    throw new Error(errorMessage);
  }

  return payload;
}

function parseWorkspaceRole(value: unknown): WorkspaceRole {
  return value === "owner" || value === "gm" ? value : "player";
}

function parseWorkspaceSummary(raw: unknown): WorkspaceSummary {
  if (
    !isObject(raw)
    || typeof raw.id !== "string"
    || typeof raw.name !== "string"
    || typeof raw.ownerUserId !== "string"
    || typeof raw.updatedAt !== "string"
  ) {
    throw new Error("Invalid workspace summary response.");
  }

  return {
    currentUserRole: parseWorkspaceRole(raw.currentUserRole),
    id: raw.id,
    name: raw.name,
    ownerUserId: raw.ownerUserId,
    updatedAt: raw.updatedAt
  };
}

function parseWorkspaceMapSummary(raw: unknown): WorkspaceMapSummary {
  if (
    !isObject(raw)
    || typeof raw.id !== "string"
    || typeof raw.name !== "string"
    || typeof raw.updatedAt !== "string"
    || typeof raw.workspaceId !== "string"
  ) {
    throw new Error("Invalid workspace map summary response.");
  }

  return {
    id: raw.id,
    name: raw.name,
    updatedAt: raw.updatedAt,
    workspaceId: raw.workspaceId
  };
}

function parseWorkspaceMapRecord(raw: unknown): WorkspaceMapRecord {
  if (
    !isObject(raw)
    || typeof raw.ownerUserId !== "string"
    || typeof raw.workspaceName !== "string"
    || !Array.isArray(raw.tokenMembers)
  ) {
    throw new Error("Invalid workspace map response.");
  }

  return {
    ...parseWorkspaceMapSummary(raw),
    content: parseSavedMapContent(raw.content),
    currentUserRole: parseWorkspaceRole(raw.currentUserRole),
    ownerUserId: raw.ownerUserId,
    tokenMembers: raw.tokenMembers.map(parseWorkspaceTokenMember),
    workspaceName: raw.workspaceName
  };
}

function parseWorkspaceMember(raw: unknown): WorkspaceMemberRecord {
  if (
    !isObject(raw)
    || typeof raw.userId !== "string"
    || typeof raw.username !== "string"
    || typeof raw.isOwner !== "boolean"
  ) {
    throw new Error("Invalid workspace member response.");
  }

  return {
    isOwner: raw.isOwner,
    role: parseWorkspaceRole(raw.role),
    userId: raw.userId,
    username: raw.username
  };
}

function parseWorkspaceTokenMember(raw: unknown): WorkspaceTokenMemberRecord {
  if (!isObject(raw) || typeof raw.color !== "string") {
    throw new Error("Invalid workspace token member response.");
  }

  return {
    ...parseWorkspaceMember(raw),
    color: raw.color
  };
}

function parseWorkspaceMembersPayload(raw: unknown): WorkspaceMembersPayload {
  if (!isObject(raw) || !Array.isArray(raw.members) || !("workspace" in raw)) {
    throw new Error("Invalid workspace members response.");
  }

  return {
    members: raw.members.map(parseWorkspaceMember),
    workspace: parseWorkspaceSummary(raw.workspace)
  };
}

function parseWorkspaceMapsPayload(raw: unknown): WorkspaceMapsPayload {
  if (
    !isObject(raw)
    || !Array.isArray(raw.maps)
    || !("workspace" in raw)
  ) {
    throw new Error("Invalid workspace maps response.");
  }

  return {
    currentUserRole: parseWorkspaceRole(raw.currentUserRole),
    maps: raw.maps.map(parseWorkspaceMapSummary),
    workspace: parseWorkspaceSummary(raw.workspace)
  };
}

export async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  const payload = await requestJson("/api/workspaces", { method: "GET" });

  if (!isObject(payload) || !Array.isArray(payload.workspaces)) {
    throw new Error("Invalid workspaces list response.");
  }

  return payload.workspaces.map(parseWorkspaceSummary);
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceSummary> {
  const payload = await requestJson("/api/workspaces", {
    body: JSON.stringify(input),
    method: "POST"
  });

  if (!isObject(payload) || !("workspace" in payload)) {
    throw new Error("Invalid create workspace response.");
  }

  return parseWorkspaceSummary(payload.workspace);
}

export async function renameWorkspaceById(workspaceId: string, name: string): Promise<WorkspaceSummary> {
  const payload = await requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}`, {
    body: JSON.stringify({ name }),
    method: "PATCH"
  });

  if (!isObject(payload) || !("workspace" in payload)) {
    throw new Error("Invalid workspace rename response.");
  }

  return parseWorkspaceSummary(payload.workspace);
}

export async function deleteWorkspaceById(workspaceId: string): Promise<void> {
  const payload = await requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}`, {
    method: "DELETE"
  });

  if (!isObject(payload) || payload.deleted !== true) {
    throw new Error("Invalid workspace delete response.");
  }
}

export async function listWorkspaceMembersById(workspaceId: string): Promise<WorkspaceMembersPayload> {
  return parseWorkspaceMembersPayload(await requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/members`, {
    method: "GET"
  }));
}

export async function addWorkspaceMemberByUsername(
  workspaceId: string,
  username: string,
  role: Extract<WorkspaceRole, "gm" | "player">
): Promise<WorkspaceMembersPayload> {
  return parseWorkspaceMembersPayload(await requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/members`, {
    body: JSON.stringify({ role, username }),
    method: "POST"
  }));
}

export async function updateWorkspaceMemberRoleById(
  workspaceId: string,
  userId: string,
  role: Extract<WorkspaceRole, "gm" | "player">
): Promise<WorkspaceMembersPayload> {
  return parseWorkspaceMembersPayload(await requestJson(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`,
    {
      body: JSON.stringify({ role }),
      method: "PATCH"
    }
  ));
}

export async function removeWorkspaceMemberById(
  workspaceId: string,
  userId: string
): Promise<WorkspaceMembersPayload> {
  return parseWorkspaceMembersPayload(await requestJson(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`,
    {
      method: "DELETE"
    }
  ));
}

export async function listWorkspaceMapsById(workspaceId: string): Promise<WorkspaceMapsPayload> {
  return parseWorkspaceMapsPayload(await requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/maps`, {
    method: "GET"
  }));
}

export async function createWorkspaceMapById(
  workspaceId: string,
  input: CreateWorkspaceMapInput
): Promise<WorkspaceMapRecord> {
  const payload = await requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/maps`, {
    body: JSON.stringify(input),
    method: "POST"
  });

  if (!isObject(payload) || !("map" in payload)) {
    throw new Error("Invalid create workspace map response.");
  }

  return parseWorkspaceMapRecord(payload.map);
}

export async function importWorkspaceMapById(
  workspaceId: string,
  input: CreateWorkspaceMapInput
): Promise<WorkspaceMapRecord> {
  const payload = await requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/maps/import`, {
    body: JSON.stringify(input),
    method: "POST"
  });

  if (!isObject(payload) || !("map" in payload)) {
    throw new Error("Invalid map import response.");
  }

  return parseWorkspaceMapRecord(payload.map);
}

export async function loadMapById(mapId: string, mode: MapOpenMode): Promise<WorkspaceMapRecord> {
  const payload = await requestJson(`/api/maps/${encodeURIComponent(mapId)}?role=${encodeURIComponent(mode)}`, {
    method: "GET"
  });

  if (!isObject(payload) || !("map" in payload)) {
    throw new Error("Invalid map load response.");
  }

  return parseWorkspaceMapRecord(payload.map);
}

export async function renameMapById(mapId: string, name: string): Promise<WorkspaceMapRecord> {
  const payload = await requestJson(`/api/maps/${encodeURIComponent(mapId)}`, {
    body: JSON.stringify({ name }),
    method: "PATCH"
  });

  if (!isObject(payload) || !("map" in payload)) {
    throw new Error("Invalid map rename response.");
  }

  return parseWorkspaceMapRecord(payload.map);
}

export async function deleteMapById(mapId: string): Promise<void> {
  const payload = await requestJson(`/api/maps/${encodeURIComponent(mapId)}`, {
    method: "DELETE"
  });

  if (!isObject(payload) || payload.deleted !== true) {
    throw new Error("Invalid map delete response.");
  }
}

export async function exportMapById(mapId: string): Promise<{ content: SavedMapContent; name: string }> {
  const payload = await requestJson(`/api/maps/${encodeURIComponent(mapId)}/export`, {
    method: "GET"
  });

  if (!isObject(payload) || typeof payload.name !== "string") {
    throw new Error("Invalid map export response.");
  }

  return {
    content: parseSavedMapContent(payload.content),
    name: payload.name
  };
}
