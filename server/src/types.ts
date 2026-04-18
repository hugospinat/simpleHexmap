import type { WebSocket } from "ws";
import type { MapOperation, MapTokenOperation, SavedMapContent } from "../../src/core/protocol/index.js";
import type { MapPermissions, ProfileRecord } from "../../src/core/profile/profileTypes.js";
import type { MapDocumentRuntime } from "./mapDocumentRuntime.js";

export type MapRecord = {
  id: string;
  name: string;
  updatedAt: string;
  permissions: MapPermissions;
  content: SavedMapContent;
};

export type MapSummary = Pick<MapRecord, "id" | "name" | "permissions" | "updatedAt">;

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

export type MapTokenUpdatedMessage = {
  type: "map_token_updated";
  operation: MapTokenOperation;
  sourceProfileId: string;
  updatedAt: string;
};

export type MapSession = {
  map: MapRecord;
  runtime: MapDocumentRuntime;
  clients: Set<WebSocket>;
  persistTimer: ReturnType<typeof setTimeout> | null;
  appliedOperationPayloads: Map<string, string>;
  appliedOperationOrder: string[];
  nextSequence: number;
};

export type { MapPermissions, ProfileRecord };
