import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

export type JsonValue = boolean | number | string | null | JsonValue[] | { [key: string]: JsonValue }

export type StoredMap = {
  id: string
  data: JsonValue
  updatedAt: string
}

export type StoredMapSummary = Pick<StoredMap, "id" | "updatedAt">

function mapFilePath(baseDirectory: string, mapId: string): string {
  return join(baseDirectory, `${mapId}.json`)
}

export function isValidMapId(mapId: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(mapId)
}

export class MapStorage {
  constructor(private readonly baseDirectory: string) {}

  async initialize(): Promise<void> {
    await mkdir(this.baseDirectory, { recursive: true })
  }

  async listMaps(): Promise<StoredMapSummary[]> {
    await this.initialize()
    const entries = await readdir(this.baseDirectory, { withFileTypes: true })
    const summaries: StoredMapSummary[] = []

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue
      }

      const id = entry.name.slice(0, -5)

      if (!isValidMapId(id)) {
        continue
      }

      const map = await this.getMap(id)

      if (!map) {
        continue
      }

      summaries.push({ id: map.id, updatedAt: map.updatedAt })
    }

    return summaries.sort((a, b) => a.id.localeCompare(b.id))
  }

  async getMap(mapId: string): Promise<StoredMap | null> {
    await this.initialize()
    const filePath = mapFilePath(this.baseDirectory, mapId)

    try {
      const raw = await readFile(filePath, "utf8")
      const parsed = JSON.parse(raw) as Partial<StoredMap>

      if (parsed.id !== mapId || typeof parsed.updatedAt !== "string" || !("data" in parsed)) {
        return null
      }

      return {
        id: parsed.id,
        data: parsed.data as JsonValue,
        updatedAt: parsed.updatedAt
      }
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
        return null
      }

      throw error
    }
  }

  async saveMap(mapId: string, data: JsonValue): Promise<StoredMap> {
    await this.initialize()
    const storedMap: StoredMap = {
      id: mapId,
      data,
      updatedAt: new Date().toISOString()
    }
    const filePath = mapFilePath(this.baseDirectory, mapId)
    await writeFile(filePath, JSON.stringify(storedMap, null, 2), "utf8")
    return storedMap
  }
}
