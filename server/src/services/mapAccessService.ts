import { getMapRecordForUser, getMapRoleForUser } from "../repositories/mapRepository.js";
import { canOpenAsGm } from "../repositories/workspaceRepository.js";
import { ForbiddenError, NotFoundError } from "../errors.js";
import type { MapRecord } from "../types.js";

export async function assertActorCanEditMap(
  mapId: string,
  actorUserId: string,
): Promise<void> {
  const role = await getMapRoleForUser(mapId, actorUserId);

  if (!role) {
    throw new NotFoundError("Map not found.");
  }

  if (!canOpenAsGm(role)) {
    throw new ForbiddenError("GM access denied.");
  }
}

export async function getWorkspaceRecordForActor(
  mapId: string,
  actorUserId: string,
): Promise<MapRecord> {
  const map = await getMapRecordForUser(mapId, actorUserId);

  if (!map) {
    throw new NotFoundError("Map not found.");
  }

  return {
    document: map.document,
    currentUserRole: map.currentUserRole,
    id: map.id,
    name: map.name,
    nextSequence: map.nextSequence,
    tokenPlacements: map.tokenPlacements,
    updatedAt: map.updatedAt,
    workspaceId: map.workspaceId,
    workspaceMembers: map.workspaceMembers,
  };
}
