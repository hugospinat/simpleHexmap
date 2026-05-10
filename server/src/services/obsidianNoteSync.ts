import { and, desc, eq, sql } from "drizzle-orm";
import type { MapNoteRecord, ObsidianNoteRevision, ObsidianNoteSnapshot } from "../../../src/core/protocol/index.js";
import { db } from "../db/client.js";
import { maps, mapNotes, opLog, workspaces } from "../db/schema.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors.js";
import { applyOperationToSession } from "../operationService.js";
import { getMapRoleForUser } from "../repositories/mapRepository.js";
import { canOpenAsGm } from "../repositories/workspaceRepository.js";

type NoteAccessContext = {
  mapId: string;
  mapName: string;
  workspaceName: string;
};

function sanitizePathSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "map";
}

export function buildObsidianNoteFilePath(input: {
  mapId: string;
  mapName: string;
  q: number;
  r: number;
}): string {
  const mapSlug = sanitizePathSegment(input.mapName);
  return `SimpleHex/${mapSlug}-${input.mapId}/hex-${input.q}-${input.r}.md`;
}

export function sanitizeObsidianNoteDraft(note: {
  gmTitle: string | null;
  markdown: string | null;
  playerTitle: string | null;
}): Pick<MapNoteRecord, "gmTitle" | "markdown" | "playerTitle"> {
  const gmTitle = note.gmTitle?.trim() ? note.gmTitle.trim() : null;
  const playerTitle = note.playerTitle?.trim() ? note.playerTitle.trim() : null;
  const markdown = note.markdown?.trim() ? note.markdown : null;

  return {
    gmTitle,
    markdown,
    playerTitle,
  };
}

export function hasObsidianNoteConflict(
  baseRevision: ObsidianNoteRevision | null,
  currentRevision: ObsidianNoteRevision,
): boolean {
  if (!baseRevision) {
    return false;
  }

  if (
    baseRevision.operationId !== null ||
    currentRevision.operationId !== null
  ) {
    return baseRevision.operationId !== currentRevision.operationId;
  }

  return baseRevision.updatedAt !== currentRevision.updatedAt;
}

async function requireNoteAccessContext(
  mapId: string,
  userId: string,
): Promise<NoteAccessContext> {
  const role = await getMapRoleForUser(mapId, userId);

  if (!role) {
    throw new NotFoundError("Map not found.");
  }

  if (!canOpenAsGm(role)) {
    throw new ForbiddenError("GM access denied.");
  }

  const rows = await db
    .select({
      mapId: maps.id,
      mapName: maps.name,
      workspaceName: workspaces.name,
    })
    .from(maps)
    .innerJoin(workspaces, eq(maps.workspaceId, workspaces.id))
    .where(eq(maps.id, mapId))
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new NotFoundError("Map not found.");
  }

  return row;
}

async function getLatestNoteRevision(
  mapId: string,
  q: number,
  r: number,
): Promise<ObsidianNoteRevision> {
  const result = await db.execute<{
    createdAt: Date;
    operationId: string;
    sourceClientId: string;
  }>(sql`
    select
      ${opLog.createdAt} as "createdAt",
      ${opLog.operationId} as "operationId",
      ${opLog.sourceClientId} as "sourceClientId"
    from ${opLog}
    where ${opLog.mapId} = ${mapId}
      and ${opLog.operation} ->> 'type' = 'set_note'
      and ((${opLog.operation} -> 'note' ->> 'q')::int) = ${q}
      and ((${opLog.operation} -> 'note' ->> 'r')::int) = ${r}
    order by ${opLog.sequence} desc
    limit 1
  `);
  const row = result.rows[0];

  if (!row) {
    return {
      operationId: null,
      sourceClientId: null,
      updatedAt: null,
    };
  }

  return {
    operationId: row.operationId,
    sourceClientId: row.sourceClientId,
    updatedAt: row.createdAt.toISOString(),
  };
}

export async function getObsidianNoteSnapshot(
  mapId: string,
  userId: string,
  q: number,
  r: number,
): Promise<ObsidianNoteSnapshot> {
  const context = await requireNoteAccessContext(mapId, userId);
  const [noteRow, latestRevision] = await Promise.all([
    db
      .select()
      .from(mapNotes)
      .where(
        and(eq(mapNotes.mapId, mapId), eq(mapNotes.q, q), eq(mapNotes.r, r)),
      )
      .limit(1),
    getLatestNoteRevision(mapId, q, r),
  ]);
  const currentNote = noteRow[0];
  const fallbackRevision =
    latestRevision.updatedAt !== null
      ? latestRevision
      : {
          operationId: null,
          sourceClientId: null,
          updatedAt: currentNote?.updatedAt.toISOString() ?? null,
        };

  return {
    mapId: context.mapId,
    mapName: context.mapName,
    note: {
      gmTitle: currentNote?.gmTitle ?? null,
      markdown: currentNote?.markdown ?? null,
      playerTitle: currentNote?.playerTitle ?? null,
      q,
      r,
    },
    noteFilePath: buildObsidianNoteFilePath({
      mapId: context.mapId,
      mapName: context.mapName,
      q,
      r,
    }),
    revision: fallbackRevision,
    workspaceName: context.workspaceName,
  };
}

export async function writeObsidianNote(input: {
  baseRevision: ObsidianNoteRevision | null;
  clientId: string;
  mapId: string;
  note: {
    gmTitle: string | null;
    markdown: string | null;
    playerTitle: string | null;
  };
  operationId: string;
  q: number;
  r: number;
  userId: string;
}): Promise<ObsidianNoteSnapshot> {
  const currentSnapshot = await getObsidianNoteSnapshot(
    input.mapId,
    input.userId,
    input.q,
    input.r,
  );

  if (hasObsidianNoteConflict(input.baseRevision, currentSnapshot.revision)) {
    throw new ConflictError("Note conflict detected.");
  }

  const sanitized = sanitizeObsidianNoteDraft(input.note);
  await applyOperationToSession(
    input.mapId,
    {
      type: "set_note",
      note: {
        q: input.q,
        r: input.r,
        ...sanitized,
      },
    },
    input.clientId,
    input.operationId,
    null,
    input.userId,
    { includeMapRecord: false },
  );

  return getObsidianNoteSnapshot(input.mapId, input.userId, input.q, input.r);
}
