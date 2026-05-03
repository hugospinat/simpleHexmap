import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { maps, opLog } from "../db/schema.js";
import { BadRequestError, NotFoundError } from "../errors.js";
import {
  applyIncrementalContentMutations,
  isIncrementalContentOperation,
} from "../repositories/incrementalContentMutations.js";
import { buildAppliedOperationMessage, operationLogRowToMessage } from "./operationMessages.js";
import {
  validateMapOperation,
} from "../../../src/core/protocol/index.js";
import type {
  AppliedOperationMessage,
  OperationEnvelope,
} from "../types.js";

export type PersistedOperationBatch = {
  newMessages: AppliedOperationMessage[];
  resolvedMessages: AppliedOperationMessage[];
  updatedAt: Date;
};

export async function persistOperationBatch(
  mapId: string,
  envelopes: OperationEnvelope[],
  sourceClientId: string,
  actorUserId: string,
): Promise<PersistedOperationBatch> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select id from ${maps} where id = ${mapId} for update`,
    );

    const mapRows = await tx.select().from(maps).where(eq(maps.id, mapId)).limit(1);
    const map = mapRows[0];

    if (!map) {
      throw new NotFoundError("Map not found.");
    }

    const operationIds = envelopes.map((envelope) => envelope.operationId);
    const duplicateRows =
      operationIds.length === 0
        ? []
        : await tx
            .select()
            .from(opLog)
            .where(and(eq(opLog.mapId, mapId), inArray(opLog.operationId, operationIds)));
    const duplicateByOperationId = new Map(
      duplicateRows.map((row) => [row.operationId, row]),
    );
    const resolvedMessages: AppliedOperationMessage[] = [];
    const newEnvelopes: OperationEnvelope[] = [];

    for (const envelope of envelopes) {
      if (typeof envelope.operationId !== "string" || !envelope.operationId.trim()) {
        throw new BadRequestError("Invalid operation id.");
      }

      const validationError = validateMapOperation(envelope.operation);

      if (validationError) {
        throw new BadRequestError(validationError);
      }

      const duplicate = duplicateByOperationId.get(envelope.operationId);

      if (duplicate) {
        resolvedMessages.push(operationLogRowToMessage(duplicate));
        continue;
      }

      newEnvelopes.push(envelope);
    }

    if (newEnvelopes.length === 0) {
      return {
        newMessages: [],
        resolvedMessages,
        updatedAt: map.updatedAt,
      };
    }

    const newMessages: AppliedOperationMessage[] = [];
    let nextSequence = map.nextSequence;
    const updatedAt = new Date();
    const opLogRows: Array<typeof opLog.$inferInsert> = [];

    for (const envelope of newEnvelopes) {
      const message = buildAppliedOperationMessage(
        envelope,
        sourceClientId,
        nextSequence,
        updatedAt,
      );
      nextSequence += 1;
      resolvedMessages.push(message);
      newMessages.push(message);

      opLogRows.push({
        actorUserId,
        createdAt: updatedAt,
        operation: envelope.operation,
        operationId: envelope.operationId,
        sequence: message.sequence,
        sourceClientId,
        mapId,
      });
    }

    if (opLogRows.length > 0) {
      await tx.insert(opLog).values(opLogRows);
    }

    const hasUnsupportedIncrementalOperation = newEnvelopes.some(
      (envelope) => !isIncrementalContentOperation(envelope.operation),
    );

    if (hasUnsupportedIncrementalOperation) {
      throw new BadRequestError("Unsupported non-incremental operation.");
    }

    await applyIncrementalContentMutations(tx, mapId, newEnvelopes, updatedAt);

    await tx.update(maps).set({ nextSequence, updatedAt }).where(eq(maps.id, mapId));

    return {
      newMessages,
      resolvedMessages,
      updatedAt,
    };
  });
}
