import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { deserializeWorld } from "@/app/document/worldMapCodec";
import type { MapSocketTransport } from "@/app/sync/mapSocketTransport";
import type { ParsedMapSyncMessage } from "@/app/sync/mapSyncMessages";
import {
  markSessionError,
  resetSessionAfterSyncError,
  resetSessionFromSnapshot,
  type MapSyncSession,
} from "@/app/sync/mapSyncSession";
import {
  applyTokenOperationToWorkspaceMembers,
  logMapSync,
} from "@/app/sync/mapSyncSupport";
import type { RenderWorldPatchInput } from "@/app/sync/renderWorldPatchState";
import {
  applyMapTokenOperation,
  type MapTokenPlacement,
} from "@/core/protocol";
import type { WorkspaceMember } from "@/core/auth/authTypes";

type HandleParsedMapSocketMessageOptions = {
  applyQueuedReceivedOperations: () => void;
  clearPreview: () => void;
  confirmedTokenPlacementsRef: MutableRefObject<MapTokenPlacement[]>;
  confirmedWorkspaceMembersRef: MutableRefObject<WorkspaceMember[]>;
  enqueueAppliedOperation: (payload: Extract<ParsedMapSyncMessage, { type: "map_operation_applied" }>["payload"]) => void;
  flushOperations: () => void;
  mapId: string;
  onAuthoritativeResync?: () => void;
  publishRenderWorldPatch: (patch: RenderWorldPatchInput) => void;
  publishSessionState: () => void;
  sessionRef: MutableRefObject<MapSyncSession>;
  setTokenPlacements: Dispatch<SetStateAction<MapTokenPlacement[]>>;
  setWorkspaceMembers: Dispatch<SetStateAction<WorkspaceMember[]>>;
  transport: MapSocketTransport;
};

export function handleParsedMapSocketMessage(
  parsed: ParsedMapSyncMessage,
  {
    applyQueuedReceivedOperations,
    clearPreview,
    confirmedTokenPlacementsRef,
    confirmedWorkspaceMembersRef,
    enqueueAppliedOperation,
    flushOperations,
    mapId,
    onAuthoritativeResync,
    publishRenderWorldPatch,
    publishSessionState,
    sessionRef,
    setTokenPlacements,
    setWorkspaceMembers,
    transport,
  }: HandleParsedMapSocketMessageOptions,
): void {
  if (parsed.type === "sync_error") {
    console.error("[MapSync] sync_error", parsed.payload);
    resetSessionAfterSyncError(sessionRef.current);
    publishRenderWorldPatch({ type: "snapshot" });
    clearPreview();
    onAuthoritativeResync?.();
    publishSessionState();
    transport.close(4001, "sync_error_resync");
    return;
  }

  if (parsed.type === "sync_snapshot") {
    const payload = parsed.payload;

    if (!Number.isInteger(payload.lastSequence) || payload.lastSequence < 0) {
      console.error("[MapSync] invalid_snapshot_sequence", payload);
      markSessionError(sessionRef.current);
      publishSessionState();
      return;
    }

    try {
      const snapshotWorld = deserializeWorld(payload.document);
      resetSessionFromSnapshot(
        sessionRef.current,
        snapshotWorld,
        payload.lastSequence,
      );
      confirmedTokenPlacementsRef.current = payload.tokenPlacements;
      confirmedWorkspaceMembersRef.current = payload.workspaceMembers;
      setTokenPlacements(payload.tokenPlacements);
      setWorkspaceMembers(payload.workspaceMembers);
      publishRenderWorldPatch({ type: "snapshot" });
      clearPreview();
      onAuthoritativeResync?.();
      publishSessionState();
      logMapSync("snapshot_loaded", {
        lastSequence: payload.lastSequence,
        mapId,
        pendingLocal: sessionRef.current.pendingOperations.length,
      });
      flushOperations();
    } catch (error) {
      console.error("[MapSync] invalid_snapshot", error);
      markSessionError(sessionRef.current);
      publishSessionState();
    }
    return;
  }

  if (parsed.type === "map_token_updated") {
    const nextPlacements = applyMapTokenOperation(
      confirmedTokenPlacementsRef.current,
      parsed.payload.operation,
    );
    confirmedTokenPlacementsRef.current = nextPlacements;
    const nextMembers = applyTokenOperationToWorkspaceMembers(
      confirmedWorkspaceMembersRef.current,
      parsed.payload.operation,
    );
    confirmedWorkspaceMembersRef.current = nextMembers;
    setTokenPlacements(nextPlacements);
    setWorkspaceMembers(nextMembers);
    return;
  }

  if (parsed.type === "map_token_error") {
    console.warn("[MapSync] token_error", parsed.payload);
    setTokenPlacements(confirmedTokenPlacementsRef.current);
    setWorkspaceMembers(confirmedWorkspaceMembersRef.current);
    return;
  }

  if (parsed.type === "map_operation_applied") {
    enqueueAppliedOperation(parsed.payload);
    applyQueuedReceivedOperations();
    return;
  }

  if (parsed.type === "unknown") {
    logMapSync("unknown_message_ignored", { mapId });
    return;
  }

  if (parsed.type === "invalid_message") {
    console.error("[MapSync] invalid_message", {
      error: parsed.error,
      mapId,
    });
    markSessionError(sessionRef.current);
    publishSessionState();
    return;
  }

  if (parsed.type === "invalid_json") {
    console.error("[MapSync] invalid_json", { mapId });
    markSessionError(sessionRef.current);
    publishSessionState();
  }
}
