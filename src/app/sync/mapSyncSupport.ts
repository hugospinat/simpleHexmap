import type { WorkspaceMember } from "@/core/auth/authTypes";
import type { MapTokenOperation } from "@/core/protocol";

export function createClientId(): string {
  return typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
    ? `client-${crypto.randomUUID()}`
    : `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isMapSyncDebugEnabled(): boolean {
  if (!import.meta.env.DEV) {
    return false;
  }

  try {
    return window.localStorage.getItem("hexmap:sync-debug") === "1";
  } catch {
    return false;
  }
}

export function logMapSync(
  event: string,
  payload: Record<string, unknown>,
): void {
  if (isMapSyncDebugEnabled()) {
    console.info(`[MapSync] ${event}`, payload);
  }
}

export function applyTokenOperationToWorkspaceMembers(
  workspaceMembers: readonly WorkspaceMember[],
  operation: MapTokenOperation,
): WorkspaceMember[] {
  if (operation.type === "set_map_token_color") {
    return workspaceMembers.map((member) =>
      member.userId === operation.userId
        ? { ...member, tokenColor: operation.color }
        : member,
    );
  }

  return [...workspaceMembers];
}
