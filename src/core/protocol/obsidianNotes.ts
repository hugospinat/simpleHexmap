import type { MapNoteRecord } from "./types.js";

export type ObsidianNoteRevision = {
  operationId: string | null;
  sourceClientId: string | null;
  updatedAt: string | null;
};

export type ObsidianNoteSnapshot = {
  mapId: string;
  mapName: string;
  note: MapNoteRecord;
  noteFilePath: string;
  revision: ObsidianNoteRevision;
  workspaceName: string;
};

export type ObsidianNoteLaunchPayload = {
  noteUrl: string;
  protocolUrl: string;
  snapshot: ObsidianNoteSnapshot;
  tokenExpiresAt: string;
};

export type ObsidianNoteWriteRequest = {
  baseRevision: ObsidianNoteRevision | null;
  clientId: string;
  note: {
    gmTitle: string | null;
    markdown: string | null;
    playerTitle: string | null;
  };
  operationId: string;
};

