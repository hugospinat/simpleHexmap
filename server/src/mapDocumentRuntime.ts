import {
  applyOperationToSavedMapContentIndex,
  indexSavedMapContent,
  materializeSavedMapContent,
  type MapOperation,
  type SavedMapContentIndex
} from "../../src/core/protocol/index.js";
import type { MapRecord } from "./types.js";

export type MapDocumentRuntime = {
  baseContent: MapRecord["content"];
  contentIndex: SavedMapContentIndex;
};

export function createMapDocumentRuntime(map: MapRecord): MapDocumentRuntime {
  return {
    baseContent: map.content,
    contentIndex: indexSavedMapContent(map.content)
  };
}

export function applyOperationToRuntime(runtime: MapDocumentRuntime, operation: MapOperation): void {
  applyOperationToSavedMapContentIndex(runtime.contentIndex, operation);
}

export function materializeRuntimeContent(runtime: MapDocumentRuntime): MapRecord["content"] {
  return materializeSavedMapContent(runtime.baseContent, runtime.contentIndex);
}

