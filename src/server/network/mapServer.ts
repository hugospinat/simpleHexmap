import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { WebSocketServer, type RawData, type WebSocket } from "ws"
import { MapSessionManager } from "@/server/session/mapSessionManager"
import {
  MapStorage,
  isValidMapId,
  type JsonValue,
  type StoredMap
} from "@/server/storage/mapStorage"

const JSON_BODY_LIMIT_BYTES = 1024 * 1024

type JsonObject = { [key: string]: JsonValue }

type GenericMapPatch = {
  op: "set" | "delete"
  path: string[]
  value?: JsonValue
}

type UpdateMapPatchMessage = {
  type: "updateMapPatch"
  patch: GenericMapPatch
}

type SetHexMessage = {
  type: "setHex"
  level: number
  hexId: string
  cell: JsonValue | null
}

type ClientMessage = UpdateMapPatchMessage | SetHexMessage

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isSafePathSegment(segment: string): boolean {
  return segment !== "" && segment !== "__proto__" && segment !== "prototype" && segment !== "constructor"
}

function ensureObject(value: JsonValue): JsonObject {
  return isJsonObject(value) ? value : {}
}

function applyMapPatch(mapData: JsonValue, patch: GenericMapPatch): JsonValue {
  const root = ensureObject(structuredClone(mapData))
  const path = patch.path

  if (path.length === 0 || !path.every((segment) => isSafePathSegment(segment))) {
    throw new Error("Invalid patch path")
  }

  let cursor: JsonObject = root

  for (const segment of path.slice(0, -1)) {
    cursor[segment] = ensureObject((cursor[segment] ?? {}) as JsonValue)
    cursor = cursor[segment] as JsonObject
  }

  const leaf = path[path.length - 1]

  if (patch.op === "delete") {
    delete cursor[leaf]
    return root
  }

  cursor[leaf] = patch.value as JsonValue
  return root
}

function parseClientMessage(rawPayload: string): GenericMapPatch {
  const parsed = JSON.parse(rawPayload) as Partial<ClientMessage>

  if (parsed.type === "updateMapPatch") {
    const patch = parsed.patch

    if (
      !patch
      || (patch.op !== "set" && patch.op !== "delete")
      || !Array.isArray(patch.path)
      || !patch.path.every((segment) => typeof segment === "string")
    ) {
      throw new Error("Invalid updateMapPatch message")
    }

    return {
      op: patch.op,
      path: patch.path,
      value: patch.value
    }
  }

  if (
    parsed.type === "setHex"
    && typeof parsed.level === "number"
    && Number.isInteger(parsed.level)
    && typeof parsed.hexId === "string"
  ) {
    return parsed.cell === null
      ? { op: "delete", path: ["levels", String(parsed.level), parsed.hexId] }
      : { op: "set", path: ["levels", String(parsed.level), parsed.hexId], value: parsed.cell as JsonValue }
  }

  throw new Error("Unsupported message type")
}

async function readJsonRequestBody(request: IncomingMessage): Promise<JsonValue> {
  const chunks: Buffer[] = []
  let totalBytes = 0

  for await (const chunk of request) {
    const currentChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    totalBytes += currentChunk.byteLength

    if (totalBytes > JSON_BODY_LIMIT_BYTES) {
      throw new Error("Request body too large")
    }

    chunks.push(currentChunk)
  }

  const body = Buffer.concat(chunks).toString("utf8")
  return JSON.parse(body || "null") as JsonValue
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json" })
  response.end(JSON.stringify(payload))
}

function parseMapIdFromHttpPath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean)

  if (parts.length !== 2 || parts[0] !== "maps") {
    return null
  }

  return parts[1]
}

async function getCurrentOrEmptyMap(storage: MapStorage, mapId: string): Promise<StoredMap> {
  const existing = await storage.getMap(mapId)
  if (existing) {
    return existing
  }
  return storage.saveMap(mapId, {})
}

export type MapServer = {
  readonly storage: MapStorage
  readonly sessionManager: MapSessionManager
  readonly httpServer: ReturnType<typeof createServer>
  start: (port?: number, host?: string) => Promise<AddressInfo>
  stop: () => Promise<void>
}

export function createMapServer(storageDirectory: string): MapServer {
  const storage = new MapStorage(storageDirectory)
  const sessionManager = new MapSessionManager()
  const httpServer = createServer(async (request, response) => {
    const method = request.method ?? "GET"
    const url = new URL(request.url ?? "/", "http://localhost")

    if (method === "GET" && url.pathname === "/maps") {
      const maps = await storage.listMaps()
      sendJson(response, 200, { maps })
      return
    }

    const mapId = parseMapIdFromHttpPath(url.pathname)

    if (!mapId || !isValidMapId(mapId)) {
      sendJson(response, 404, { error: "Not found" })
      return
    }

    if (method === "GET") {
      const map = await storage.getMap(mapId)

      if (!map) {
        sendJson(response, 404, { error: "Map not found" })
        return
      }

      sendJson(response, 200, map)
      return
    }

    if (method === "PUT") {
      try {
        const data = await readJsonRequestBody(request)
        const map = await storage.saveMap(mapId, data)
        sendJson(response, 200, map)
      } catch (error: unknown) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : "Invalid JSON body" })
      }

      return
    }

    sendJson(response, 405, { error: "Method not allowed" })
  })

  const wsServer = new WebSocketServer({ noServer: true })

  const handleSocketConnection = async (socket: WebSocket, mapId: string) => {
    sessionManager.join(mapId, socket)

    socket.on("message", async (buffer: RawData) => {
      try {
        const patch = parseClientMessage(buffer.toString())
        const currentMap = await getCurrentOrEmptyMap(storage, mapId)
        const updatedData = applyMapPatch(currentMap.data, patch)
        const savedMap = await storage.saveMap(mapId, updatedData)
        const updateEvent = JSON.stringify({
          type: "mapUpdated",
          mapId,
          patch,
          updatedAt: savedMap.updatedAt
        })
        sessionManager.broadcastToOthers(mapId, socket, updateEvent)
      } catch (error: unknown) {
        socket.send(
          JSON.stringify({
            type: "error",
            message: error instanceof Error ? error.message : "Invalid update"
          })
        )
      }
    })

    socket.on("close", () => {
      sessionManager.leave(mapId, socket)
    })

    const map = await getCurrentOrEmptyMap(storage, mapId)
    socket.send(JSON.stringify({ type: "mapSnapshot", mapId, map: map.data, updatedAt: map.updatedAt }))
  }

  httpServer.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", "http://localhost")
    const match = /^\/ws\/maps\/([a-zA-Z0-9_-]+)$/.exec(url.pathname)

    if (!match) {
      socket.destroy()
      return
    }

    const mapId = match[1]

    wsServer.handleUpgrade(request, socket, head, (webSocket: WebSocket) => {
      void handleSocketConnection(webSocket, mapId)
    })
  })

  return {
    storage,
    sessionManager,
    httpServer,
    async start(port = 0, host = "127.0.0.1") {
      await storage.initialize()
      await new Promise<void>((resolve) => httpServer.listen(port, host, () => resolve()))
      return httpServer.address() as AddressInfo
    },
    async stop() {
      for (const client of wsServer.clients) {
        client.terminate()
      }
      await new Promise<void>((resolve, reject) => {
        wsServer.close((error?: Error) => (error ? reject(error) : resolve()))
      })
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()))
      })
    }
  }
}
