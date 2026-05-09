import { describe, expect, it, vi } from "vitest";
import { parseMapSyncSocketMessage } from "@/app/sync/mapSyncMessages";
import {
  commitSessionLocalOperations,
  createMapSyncSession,
  markSessionOperationsSent,
  resetSessionFromSnapshot,
} from "@/app/sync/mapSyncSession";
import { handleParsedMapSocketMessage } from "@/app/sync/mapSocketMessageHandler";
import { createEmptyWorld } from "@/core/map/world";

describe("mapSocketMessageHandler", () => {
  it("treats map operation rate-limit errors as retryable and keeps the socket open", () => {
    const session = createMapSyncSession("client-a", createEmptyWorld());
    resetSessionFromSnapshot(session, createEmptyWorld(), 0);
    const [envelope] = commitSessionLocalOperations(
      session,
      [
        {
          type: "set_tiles",
          tiles: [{ q: 0, r: 0, terrain: "forest", hidden: false }],
        },
      ],
      100,
    );
    markSessionOperationsSent(session, [envelope]);

    const parsed = parseMapSyncSocketMessage(
      JSON.stringify({
        type: "map_operation_error",
        error: "Too many operations.",
        retryAfterMs: 250,
      }),
    );

    const publishSessionState = vi.fn();
    const scheduleOperationRetry = vi.fn();
    const transport = {
      close: vi.fn(),
      sendJson: vi.fn(),
      socket: { readyState: WebSocket.OPEN } as WebSocket,
    };

    handleParsedMapSocketMessage(parsed, {
      applyQueuedReceivedOperations: vi.fn(),
      clearPreview: vi.fn(),
      confirmedDocumentRef: { current: { version: 2, tiles: [], features: [], rivers: [], roads: [], factions: [], factionTerritories: [], notes: [] } },
      confirmedTokenPlacementsRef: { current: [] },
      confirmedWorkspaceMembersRef: { current: [] },
      enqueueAppliedOperation: vi.fn(),
      flushOperations: vi.fn(),
      mapId: "map-1",
      publishRenderWorldPatch: vi.fn(),
      publishSessionState,
      scheduleOperationRetry,
      sessionRef: { current: session },
      setTokenPlacements: vi.fn(),
      setWorkspaceMembers: vi.fn(),
      transport,
    });

    expect(parsed.type).toBe("map_operation_error");
    expect(session.pendingOperations).toHaveLength(1);
    expect(session.pendingOperations[0].sent).toBe(false);
    expect(session.status).toBe("saving");
    expect(scheduleOperationRetry).toHaveBeenCalledWith(250);
    expect(publishSessionState).toHaveBeenCalled();
    expect(transport.close).not.toHaveBeenCalled();
  });
});