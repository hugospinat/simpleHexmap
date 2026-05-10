import { type IncomingMessage, type ServerResponse } from "node:http";
import { ConflictError } from "../errors.js";
import { requireAuth } from "../services/authService.js";
import { issueObsidianMapToken, requireObsidianMapAuth } from "../services/obsidianNoteAuth.js";
import { getObsidianNoteSnapshot, writeObsidianNote } from "../services/obsidianNoteSync.js";
import { obsidianLaunchBodySchema, obsidianNoteWriteBodySchema } from "../validation/httpSchemas.js";
import { readBody, sendJson } from "./httpHelpers.js";

const idPatternSource = "[a-zA-Z0-9_-]{1,80}";
const integerPatternSource = "-?\\d+";

export const obsidianLaunchPathPattern = new RegExp(
  `^/api/maps/(${idPatternSource})/obsidian/launch$`,
);
export const obsidianNotePathPattern = new RegExp(
  `^/api/obsidian/maps/(${idPatternSource})/notes/(${integerPatternSource})/(${integerPatternSource})$`,
);

function firstHeaderValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function getRequestOrigin(request: IncomingMessage): string {
  const originHeader = firstHeaderValue(request.headers.origin);

  if (originHeader) {
    try {
      return new URL(originHeader).origin;
    } catch {
      // fall through
    }
  }

  const forwardedProto = firstHeaderValue(request.headers["x-forwarded-proto"]);
  const forwardedHost = firstHeaderValue(request.headers["x-forwarded-host"]);
  const host = forwardedHost ?? firstHeaderValue(request.headers.host) ?? "localhost";
  const protocol = forwardedProto ?? "http";
  return `${protocol}://${host}`;
}

function buildObsidianProtocolUrl(input: {
  apiBaseUrl: string;
  mapId: string;
  q: number;
  r: number;
  token: string;
}): string {
  const params = new URLSearchParams({
    apiBaseUrl: input.apiBaseUrl,
    mapId: input.mapId,
    q: String(input.q),
    r: String(input.r),
    token: input.token,
  });
  return `obsidian://simplehex-note?${params.toString()}`;
}

export async function handleObsidianLaunchRequest(
  request: IncomingMessage,
  response: ServerResponse,
  match: RegExpMatchArray,
): Promise<boolean> {
  if (request.method !== "POST") {
    return false;
  }

  const auth = await requireAuth(request);
  const mapId = match[1];
  const body = obsidianLaunchBodySchema.parse(await readBody(request));
  const snapshot = await getObsidianNoteSnapshot(mapId, auth.user.id, body.q, body.r);
  const apiBaseUrl = getRequestOrigin(request);
  const { expiresAt, token } = issueObsidianMapToken({
    mapId,
    userId: auth.user.id,
  });
  const noteUrl = `${apiBaseUrl}/api/obsidian/maps/${encodeURIComponent(mapId)}/notes/${body.q}/${body.r}`;

  sendJson(response, 200, {
    noteUrl,
    protocolUrl: buildObsidianProtocolUrl({
      apiBaseUrl,
      mapId,
      q: body.q,
      r: body.r,
      token,
    }),
    snapshot,
    tokenExpiresAt: expiresAt,
  });
  return true;
}

export async function handleObsidianNoteRequest(
  request: IncomingMessage,
  response: ServerResponse,
  match: RegExpMatchArray,
): Promise<boolean> {
  const mapId = match[1];
  const q = Number.parseInt(match[2] ?? "", 10);
  const r = Number.parseInt(match[3] ?? "", 10);
  const auth = await requireObsidianMapAuth(request, mapId);

  if (request.method === "GET") {
    sendJson(response, 200, await getObsidianNoteSnapshot(mapId, auth.userId, q, r));
    return true;
  }

  if (request.method === "PUT") {
    const body = obsidianNoteWriteBodySchema.parse(await readBody(request));

    try {
      sendJson(
        response,
        200,
        await writeObsidianNote({
          baseRevision: body.baseRevision
            ? {
                operationId: body.baseRevision.operationId ?? null,
                sourceClientId: body.baseRevision.sourceClientId ?? null,
                updatedAt: body.baseRevision.updatedAt ?? null,
              }
            : null,
          clientId: body.clientId,
          mapId,
          note: {
            gmTitle: body.note.gmTitle ?? null,
            markdown: body.note.markdown ?? null,
            playerTitle: body.note.playerTitle ?? null,
          },
          operationId: body.operationId,
          q,
          r,
          userId: auth.userId,
        }),
      );
    } catch (error) {
      if (error instanceof ConflictError) {
        sendJson(response, 409, {
          current: await getObsidianNoteSnapshot(mapId, auth.userId, q, r),
          error: "Note conflict detected.",
        });
        return true;
      }

      throw error;
    }

    return true;
  }

  return false;
}
