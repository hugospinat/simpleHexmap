import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { createInitialWorld, type World } from "../src/domain/world/world";
import { deserializeWorld, serializeWorld, type SerializedWorld } from "../src/domain/world/worldSerialization";
import type { MapDocument, MapSummary } from "../src/shared/mapProtocol";

type StoredMapDocument = {
  id: string;
  name: string;
  updatedAt: string;
  world: SerializedWorld;
};

function normalizeName(name: string | undefined, fallback = "Nouvelle map"): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed : fallback;
}

export class FileMapStore {
  private readonly mapsDirectory: string;

  constructor(dataDirectory: string) {
    this.mapsDirectory = join(dataDirectory, "maps");
  }

  private getFilePath(mapId: string): string {
    return join(this.mapsDirectory, `${mapId}.json`);
  }

  async init() {
    await mkdir(this.mapsDirectory, { recursive: true });
  }

  async listMaps(): Promise<MapSummary[]> {
    await this.init();
    const files = await readdir(this.mapsDirectory, { withFileTypes: true });
    const maps: MapSummary[] = [];

    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".json")) {
        continue;
      }

      try {
        const map = await this.readMap(file.name.slice(0, -5));
        maps.push({ id: map.id, name: map.name, updatedAt: map.updatedAt });
      } catch {
        // skip invalid map files
      }
    }

    return maps.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async readMap(mapId: string): Promise<MapDocument> {
    const content = await readFile(this.getFilePath(mapId), "utf-8");
    const raw = JSON.parse(content) as StoredMapDocument;

    return {
      id: raw.id,
      name: normalizeName(raw.name),
      updatedAt: raw.updatedAt,
      world: serializeWorld(deserializeWorld(raw.world))
    };
  }

  async createMap(name: string, world?: World): Promise<MapDocument> {
    const now = new Date().toISOString();
    const map: MapDocument = {
      id: randomUUID(),
      name: normalizeName(name),
      updatedAt: now,
      world: serializeWorld(world ?? createInitialWorld(3))
    };
    await this.writeMap(map);
    return map;
  }

  async updateMap(mapId: string, updates: { name?: string; world?: World }): Promise<MapDocument> {
    const current = await this.readMap(mapId);
    const next: MapDocument = {
      id: current.id,
      name: normalizeName(updates.name ?? current.name),
      updatedAt: new Date().toISOString(),
      world: updates.world ? serializeWorld(updates.world) : current.world
    };
    await this.writeMap(next);
    return next;
  }

  async importMap(name: string | undefined, payload: unknown): Promise<MapDocument> {
    const normalized = this.normalizeImportedWorld(payload);
    return this.createMap(normalizeName(name, "Map importée"), deserializeWorld(normalized));
  }

  private normalizeImportedWorld(payload: unknown): SerializedWorld {
    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid JSON payload.");
    }

    const input = payload as { world?: unknown };
    const worldCandidate = input.world ?? payload;
    return serializeWorld(deserializeWorld(worldCandidate));
  }

  private async writeMap(map: MapDocument) {
    const filePath = this.getFilePath(map.id);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(map, null, 2)}\n`, "utf-8");
  }
}
