import type { WebSocket } from "ws";
import type { MapOperation, MapTokenOperation, SavedMapContent } from "../../src/core/protocol/index.js";
import type { UserRecord, WorkspaceRole } from "../../src/core/auth/authTypes.js";

export type MapRecord = {
  currentUserRole: WorkspaceRole;
  id: string;
  name: string;
  ownerUserId: string;
  updatedAt: string;
  workspaceId: string;
  content: SavedMapContent;
};

export type MapSummary = Pick<MapRecord, "currentUserRole" | "id" | "name" | "ownerUserId" | "updatedAt">;

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
  workspaceId: string;
  clients: Set<WebSocket>;
};

export type { UserRecord, WorkspaceRole };
