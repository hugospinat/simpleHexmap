import type {
  MapDocument,
  MapOperation,
  MapTokenOperation,
  MapTokenPlacement,
} from "@/core/protocol";
import type { WorkspaceMember } from "@/core/auth/authTypes";

export type MapOperationMessage = {
  type: "map_operation_applied";
  sequence: number;
  operationId: string;
  operation: MapOperation;
  sourceClientId: string;
  updatedAt: string;
};

export type MapAppliedOperationEntry = Omit<MapOperationMessage, "type">;

export type MapSyncSnapshotMessage = {
  type: "sync_snapshot";
  lastSequence: number;
  workspaceMembers: WorkspaceMember[];
  updatedAt: string;
  document: MapDocument;
  tokenPlacements: MapTokenPlacement[];
};

export type MapTokenUpdateRequest = {
  type: "map_token_update";
  operation: MapTokenOperation;
};

export type MapTokenUpdatedMessage = {
  type: "map_token_updated";
  operation: MapTokenOperation;
  sourceUserId: string;
  updatedAt: string;
};

export type MapTokenErrorMessage = {
  type: "map_token_error";
  error: string;
};

export type MapOperationRequest = {
  type: "map_operation";
  operationId: string;
  operation: MapOperation;
  clientId: string;
};
