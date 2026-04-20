import { and, eq, sql } from "drizzle-orm";
import { db } from "./db/client.js";
import {
  hexCells,
  mapTokens,
  workspaceMembers,
  workspaceMemberTokens,
  maps,
} from "./db/schema.js";
import {
  getMapRecordForUser,
  getMapRoleForUser,
  getWorkspaceIdForMap,
} from "./repositories/mapRepository.js";
import {
  canOpenAsGm,
  touchWorkspaceUpdatedAt,
} from "./repositories/workspaceRepository.js";
import { getOrCreateSession } from "./sessionStore.js";
import { broadcastRoleAwareSessionPayloads } from "./sessionDelivery.js";
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
    content: map.content,
    currentUserRole: map.currentUserRole,
    id: map.id,
    name: map.name,
    ownerUserId: map.ownerUserId,
    tokenMembers: map.tokenMembers,
    updatedAt: map.updatedAt,
    workspaceId: map.workspaceId,
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
      ? operation.token.userId
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
            eq(hexCells.q, operation.token.q),
            eq(hexCells.r, operation.token.r),
          ),
        )
        .limit(1);
      const tile = tileRows[0];

      if (!tile || tile.hidden === 1) {
        throw new Error("Token can only be placed on visible terrain.");
      }

      await tx
        .insert(workspaceMemberTokens)
        .values({
          color: operation.token.color,
          updatedAt: now,
          userId: operation.token.userId,
          workspaceId,
        })
        .onConflictDoUpdate({
          target: [
            workspaceMemberTokens.workspaceId,
            workspaceMemberTokens.userId,
          ],
          set: {
            color: operation.token.color,
            updatedAt: now,
          },
        });

      await tx
        .insert(mapTokens)
        .values({
          q: operation.token.q,
          r: operation.token.r,
          userId: operation.token.userId,
          mapId,
        })
        .onConflictDoUpdate({
          target: [mapTokens.mapId, mapTokens.userId],
          set: {
            q: operation.token.q,
            r: operation.token.r,
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
        .insert(workspaceMemberTokens)
        .values({
          color: operation.color,
          updatedAt: now,
          userId: operation.userId,
          workspaceId,
        })
        .onConflictDoUpdate({
          target: [
            workspaceMemberTokens.workspaceId,
            workspaceMemberTokens.userId,
          ],
          set: {
            color: operation.color,
            updatedAt: now,
          },
        });
    }

    await tx.update(maps).set({ updatedAt: now }).where(eq(maps.id, mapId));
  });

  const workspaceId = await getWorkspaceIdForMap(mapId);

  if (workspaceId) {
    await touchWorkspaceUpdatedAt(workspaceId);
  }

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
