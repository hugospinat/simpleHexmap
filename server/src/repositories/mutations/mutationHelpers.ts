import type { MapOperation } from "../../../../src/core/protocol/index.js";

export type DbLike = any;
export type Axial = { q: number; r: number };
export type IncrementalContentOperation = MapOperation;

export type IncrementalOperationHandler<
  K extends IncrementalContentOperation["type"],
> = (
  tx: DbLike,
  mapId: string,
  operation: Extract<IncrementalContentOperation, { type: K }>,
  updatedAt: Date,
) => Promise<void>;

export const mutationChunkSize = 500;

export function boolInt(value: boolean): number {
  return value ? 1 : 0;
}

export function cellKey(cell: Axial): string {
  return `${cell.q},${cell.r}`;
}

export function uniqueCells(cells: Axial[]): Axial[] {
  const seen = new Set<string>();
  const result: Axial[] = [];

  for (const cell of cells) {
    const key = cellKey(cell);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(cell);
  }

  return result;
}

export function chunkValues<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}
