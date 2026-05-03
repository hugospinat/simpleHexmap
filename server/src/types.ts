import type { WebSocket } from "ws";
import type { MemoryRateLimiter } from "./security/rateLimiter.js";
import type {
  MapDocument,
  MapOperation,
  MapTokenOperation,
  MapTokenPlacement,
} from "../../src/core/protocol/index.js";
import type {
  UserRecord,
  WorkspaceMember,
  WorkspaceRole,
} from "../../src/core/auth/authTypes.js";

export type MapRecord = {
  currentUserRole: WorkspaceRole;
  document: MapDocument;
  id: string;
  name: string;
  nextSequence: number;
  tokenPlacements: MapTokenPlacement[];
  updatedAt: string;
  workspaceId: string;
  workspaceMembers: WorkspaceMember[];
};

export type MapSummary = Pick<
  MapRecord,
  "currentUserRole" | "id" | "name" | "updatedAt"
>;

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
  sourceUserId: string;
  updatedAt: string;
};

export type MapSessionClient = {
  userId: string;
  visibilityMode: "gm" | "player";
};

export type MapSession = {
  mapId: string;
  clients: Map<WebSocket, MapSessionClient>;
  operationRateLimiter: MemoryRateLimiter;
};

export type { UserRecord, WorkspaceRole };
