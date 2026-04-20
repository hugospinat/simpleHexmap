import type { MapOperation, MapTokenOperation } from "@/core/protocol";
import type { WorkspaceTokenMemberRecord } from "@/core/auth/authTypes";
import type { SavedMapContent } from "@/core/document/savedMapTypes";

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
  tokenMembers: WorkspaceTokenMemberRecord[];
  updatedAt: string;
  content: SavedMapContent;
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
