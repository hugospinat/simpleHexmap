import type { MapOperation } from "./types.js";

export type OperationApplier<TState> = {
  apply: (state: TState, operation: MapOperation) => TState;
  applyMany: (state: TState, operations: readonly MapOperation[]) => TState;
};

export type MapOperationEnvelope = {
  clientId?: string;
  operation: MapOperation;
  operationId: string;
  sequence?: number;
};
