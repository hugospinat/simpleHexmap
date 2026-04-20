import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { maps, workspaces } from "../db/schema.js";
import {
  materializeMapDocument,
  materializeTokenPlacements,
  replaceMapDocument,
} from "./mapContentRepository.js";
import {
  canOpenAsGm,
  getWorkspaceRole,
  listWorkspaceMembersForWorkspace,
  requireWorkspaceAndRole,
  toMapSummary,
  type WorkspaceMapRecord,
} from "./workspaceRepository.js";
import type { MapDocument } from "../../../src/core/protocol/index.js";
import type {
  UserId,
  WorkspaceRole,
} from "../../../src/core/auth/authTypes.js";
import { ForbiddenError, NotFoundError } from "../errors.js";

async function getMapRowForUser(mapId: string, userId: UserId) {
  const rows = await db
    .select({ map: maps, workspaceName: workspaces.name })
    .from(maps)
    .innerJoin(workspaces, eq(maps.workspaceId, workspaces.id))
    .where(eq(maps.id, mapId))
    .limit(1);
  const row = rows[0];
  const map = row?.map;

  if (!map) {
    return null;
  }

  const role = await getWorkspaceRole(map.workspaceId, userId);

  if (!role) {
    return null;
  }

  return { map, role, workspaceName: row.workspaceName };
}

export async function getMapRoleForUser(
  mapId: string,
  userId: UserId,
): Promise<WorkspaceRole | null> {
  const row = await getMapRowForUser(mapId, userId);
  return row?.role ?? null;
}

export async function getMapRecordForUser(
  mapId: string,
  userId: UserId,
): Promise<WorkspaceMapRecord | null> {
  const row = await getMapRowForUser(mapId, userId);

  if (!row) {
    return null;
  }

  const [document, tokenPlacements, workspaceMembers] = await Promise.all([
    materializeMapDocument(row.map.id),
    materializeTokenPlacements(row.map.id),
    listWorkspaceMembersForWorkspace(row.map.workspaceId),
  ]);

  return {
    ...toMapSummary(row.map),
    currentUserRole: row.role,
    document,
    nextSequence: row.map.nextSequence,
    tokenPlacements,
    workspaceMembers,
    workspaceName: row.workspaceName,
  };
}

export async function createMapInWorkspace(input: {
  actorUserId: UserId;
  content: MapDocument;
  name: string;
  workspaceId: string;
}): Promise<WorkspaceMapRecord> {
  const { role } = await requireWorkspaceAndRole(
    input.workspaceId,
    input.actorUserId,
  );

  if (!canOpenAsGm(role)) {
    throw new ForbiddenError("GM access denied.");
  }

  const now = new Date();
  const mapId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(maps).values({
      createdAt: now,
      id: mapId,
      name: input.name,
      nextSequence: 1,
      updatedAt: now,
      workspaceId: input.workspaceId,
    });
    await replaceMapDocument(mapId, input.content, tx);
  });

  const created = await getMapRecordForUser(mapId, input.actorUserId);

  if (!created) {
    throw new NotFoundError("Could not create map.");
  }

  return created;
}

export async function renameWorkspaceMap(input: {
  actorUserId: UserId;
  mapId: string;
  name: string;
}): Promise<WorkspaceMapRecord> {
  const map = await getMapRecordForUser(input.mapId, input.actorUserId);

  if (!map) {
    throw new NotFoundError("Map not found.");
  }

  if (!canOpenAsGm(map.currentUserRole)) {
    throw new ForbiddenError("GM access denied.");
  }

  await db
    .update(maps)
    .set({ name: input.name, updatedAt: new Date() })
    .where(eq(maps.id, input.mapId));

  const updated = await getMapRecordForUser(input.mapId, input.actorUserId);

  if (!updated) {
    throw new NotFoundError("Map not found.");
  }

  return updated;
}

export async function deleteWorkspaceMap(input: {
  actorUserId: UserId;
  mapId: string;
}): Promise<boolean> {
  const map = await getMapRecordForUser(input.mapId, input.actorUserId);

  if (!map) {
    throw new NotFoundError("Map not found.");
  }

  if (!canOpenAsGm(map.currentUserRole)) {
    throw new ForbiddenError("GM access denied.");
  }

  const deleted = await db
    .delete(maps)
    .where(eq(maps.id, input.mapId))
    .returning({ id: maps.id });

  return deleted.length > 0;
}

export async function getWorkspaceIdForMap(
  mapId: string,
): Promise<string | null> {
  const rows = await db
    .select({ workspaceId: maps.workspaceId })
    .from(maps)
    .where(eq(maps.id, mapId))
    .limit(1);

  return rows[0]?.workspaceId ?? null;
}
