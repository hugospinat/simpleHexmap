import { WebSocket } from "ws";
import { getMapRecordForUser } from "./repositories/mapRepository.js";
import {
  filterMapRecordForVisibilityMode,
  getVisibilityModeForMapRole,
} from "./repositories/mapVisibility.js";

export async function sendSyncSnapshot(
  client: WebSocket,
  mapId: string,
  userId: string,
): Promise<boolean> {
  if (client.readyState !== WebSocket.OPEN) {
    return false;
  }

  const map = await getMapRecordForUser(mapId, userId);

  if (!map) {
    client.close(1008, "map_not_found");
    return false;
  }

  const visibleMap = filterMapRecordForVisibilityMode(
    map,
    getVisibilityModeForMapRole(map),
  );

  client.send(
    JSON.stringify({
      type: "sync_snapshot",
      lastSequence: visibleMap.nextSequence - 1,
      workspaceMembers: visibleMap.workspaceMembers,
      updatedAt: visibleMap.updatedAt,
      document: visibleMap.document,
      tokenPlacements: visibleMap.tokenPlacements,
    }),
  );
  return true;
}
