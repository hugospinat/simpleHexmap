import type { WebSocket } from "ws";
import type { MapOperation, SavedMapContent } from "../../src/core/protocol/index.js";

export type MapRecord = {
  id: string;
  name: string;
  updatedAt: string;
  content: SavedMapContent;
};

export type MapSummary = Pick<MapRecord, "id" | "name" | "updatedAt">;

export type AppliedOperationMessage = {
  type: "map_operation_applied";
  sequence: number;
  operationId: string;
  operation: MapOperation;
  sourceClientId: string;
  updatedAt: string;
};

export type OperationEnvelope = {
  operationId: string;
  operation: MapOperation;
};

export type MapSession = {
  map: MapRecord;
  clients: Set<WebSocket>;
  persistTimer: ReturnType<typeof setTimeout> | null;
  appliedOperationPayloads: Map<string, string>;
  appliedOperationOrder: string[];
  nextSequence: number;
};
