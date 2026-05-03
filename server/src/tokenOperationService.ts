import { and, eq, sql } from "drizzle-orm";
import { db } from "./db/client.js";
import { hexCells, mapTokens, workspaceMembers, maps } from "./db/schema.js";
import {
  getMapRecordForUser,
  getMapRoleForUser,
} from "./repositories/mapRepository.js";
import { canOpenAsGm } from "./repositories/workspaceRepository.js";
import {
  broadcastRoleAwareSessionPayloads,
  getOrCreateSession,
} from "./services/realtime/index.js";
import { sendSyncSnapshot } from "./syncSnapshotService.js";
import {
  validateMapTokenOperation,
  type MapTokenOperation,
} from "../../src/core/protocol/index.js";
import type { MapRecord, MapTokenUpdatedMessage } from "./types.js";

async function getWorkspaceRecordForActor(
  workspaceId: string,
  actorUserId: string,
): Promise<MapRecord> {
  const map = await getMapRecordForUser(workspaceId, actorUserId);

  if (!map) {
    throw new Error("Map not found.");
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

export async function applyTokenOperationToSession(
  mapId: string,
  operation: MapTokenOperation,
  sourceUserId: string,
): Promise<MapRecord> {
  const validationError = validateMapTokenOperation(operation);

  if (validationError) {
    throw new Error(validationError);
  }

  const role = await getMapRoleForUser(mapId, sourceUserId);

  if (!role) {
    throw new Error("Map not found.");
  }

  const canManageOtherUserTokens = canOpenAsGm(role);
  const targetUserId =
    operation.type === "set_map_token"
      ? operation.placement.userId
      : operation.userId;

  if (targetUserId !== sourceUserId && !canManageOtherUserTokens) {
    throw new Error(
      operation.type === "remove_map_token"
        ? "Cannot remove another user token."
        : operation.type === "set_map_token_color"
          ? "Cannot change another user token color."
          : "Cannot move another user token.",
    );
  }

  await db.transaction(async (tx) => {
    const mapRows = await tx
      .select({
        workspaceId: maps.workspaceId,
      })
      .from(maps)
      .where(eq(maps.id, mapId))
      .limit(1);
    const workspaceId = mapRows[0]?.workspaceId ?? null;

    if (!workspaceId) {
      throw new Error("Map not found.");
    }

    const membershipRows = await tx
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, targetUserId),
        ),
      )
      .limit(1);

    if (membershipRows.length === 0) {
      throw new Error("Token user is not in this workspace.");
    }

    await tx.execute(
      sql`select id from ${maps} where id = ${mapId} for update`,
    );
    const now = new Date();

    if (operation.type === "set_map_token") {
      const tileRows = await tx
        .select()
        .from(hexCells)
        .where(
          and(
            eq(hexCells.mapId, mapId),
            eq(hexCells.q, operation.placement.q),
            eq(hexCells.r, operation.placement.r),
          ),
        )
        .limit(1);
      const tile = tileRows[0];

      if (!tile || tile.hidden) {
        throw new Error("Token can only be placed on visible terrain.");
      }

      await tx
        .insert(mapTokens)
        .values({
          q: operation.placement.q,
          r: operation.placement.r,
          userId: operation.placement.userId,
          mapId,
        })
        .onConflictDoUpdate({
          target: [mapTokens.mapId, mapTokens.userId],
          set: {
            q: operation.placement.q,
            r: operation.placement.r,
          },
        });
    } else if (operation.type === "remove_map_token") {
      await tx
        .delete(mapTokens)
        .where(
          and(
            eq(mapTokens.mapId, mapId),
            eq(mapTokens.userId, operation.userId),
          ),
        );
    } else {
      await tx
        .update(workspaceMembers)
        .set({ tokenColor: operation.color, updatedAt: now })
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.userId, operation.userId),
          ),
        );
    }

    await tx.update(maps).set({ updatedAt: now }).where(eq(maps.id, mapId));
  });

  const updated = await getWorkspaceRecordForActor(mapId, sourceUserId);
  const message: MapTokenUpdatedMessage = {
    type: "map_token_updated",
    operation,
    sourceUserId,
    updatedAt: updated.updatedAt,
  };

  await broadcastRoleAwareSessionPayloads(
    getOrCreateSession(mapId),
    [JSON.stringify(message)],
    sendSyncSnapshot,
  );

  return updated;
}
