import { WebSocket } from "ws";
import type {
  MapOperation,
  MapTokenOperation,
} from "../../../src/core/protocol/index.js";
import { applyOperationToSession } from "../operationService.js";
import { applyTokenOperationToSession } from "../tokenOperationService.js";
import {
  wsMapOperationMessageSchema,
  wsTokenUpdateMessageSchema,
} from "../validation/httpSchemas.js";

export async function handleClientMessage(
  mapId: string,
  client: WebSocket,
  raw: WebSocket.RawData,
  userId: string,
): Promise<void> {
  const message = JSON.parse(raw.toString("utf8"));

  const tokenResult = wsTokenUpdateMessageSchema.safeParse(message);

  if (tokenResult.success) {
    try {
      await applyTokenOperationToSession(
        mapId,
        tokenResult.data.operation as MapTokenOperation,
        userId,
      );
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Invalid token operation.";

      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "map_token_error", error: detail }));
      }
    }
    return;
  }

  const opResult = wsMapOperationMessageSchema.safeParse(message);

  if (!opResult.success) {
    console.warn("[MapSyncServer] invalid_operation_message", {
      mapId,
      raw: raw.toString("utf8"),
    });
    return;
  }

  await applyOperationToSession(
    mapId,
    opResult.data.operation as MapOperation,
    opResult.data.clientId,
    opResult.data.operationId,
    client,
    userId,
    {
      includeMapRecord: false,
    },
  );
}
