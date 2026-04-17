import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, describe, expect, it } from "vitest"
import { WebSocket, type RawData } from "ws"
import { createMapServer, type MapServer } from "@/server/network/mapServer"

function waitForSocketOpen(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("WebSocket open timeout")), 2000)
    socket.once("open", () => {
      clearTimeout(timeout)
      resolve()
    })
    socket.once("error", (error: Error) => {
      clearTimeout(timeout)
      reject(error)
    })
  })
}

function waitForSocketMessage(
  socket: WebSocket,
  predicate: (message: Record<string, unknown>) => boolean = () => true
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("WebSocket message timeout")), 2000)
    const onMessage = (buffer: RawData) => {
      const payload = Buffer.isBuffer(buffer) ? buffer.toString("utf8") : String(buffer)
      const message = JSON.parse(payload) as Record<string, unknown>

      if (!predicate(message)) {
        return
      }

      clearTimeout(timeout)
      socket.off("message", onMessage)
      resolve(message)
    }
    socket.on("message", onMessage)
    socket.once("error", (error: Error) => {
      clearTimeout(timeout)
      socket.off("message", onMessage)
      reject(error)
    })
  })
}

describe("map server", () => {
  let server: MapServer | null = null
  let storageDirectory: string | null = null

  afterEach(async () => {
    if (server) {
      await server.stop()
      server = null
    }

    if (storageDirectory) {
      await rm(storageDirectory, { recursive: true, force: true })
      storageDirectory = null
    }
  })

  async function startServer(): Promise<{ baseHttpUrl: string; baseWsUrl: string }> {
    storageDirectory = await mkdtemp(join(tmpdir(), "hexmap-server-test-"))
    server = createMapServer(storageDirectory)
    const address = await server.start()
    const baseHttpUrl = `http://${address.address}:${address.port}`
    const baseWsUrl = `ws://${address.address}:${address.port}`
    return { baseHttpUrl, baseWsUrl }
  }

  it("loads and saves a map with GET/PUT endpoints", async () => {
    const { baseHttpUrl } = await startServer()
    const mapId = "alpha"
    const mapData = { levels: { "3": { "0,0": { type: "plain" } } } }

    const putResponse = await fetch(`${baseHttpUrl}/maps/${mapId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(mapData)
    })
    expect(putResponse.status).toBe(200)

    const getResponse = await fetch(`${baseHttpUrl}/maps/${mapId}`)
    expect(getResponse.status).toBe(200)
    const storedMap = await getResponse.json() as { id: string; data: unknown }
    expect(storedMap.id).toBe(mapId)
    expect(storedMap.data).toEqual(mapData)

    const listResponse = await fetch(`${baseHttpUrl}/maps`)
    expect(listResponse.status).toBe(200)
    const listBody = await listResponse.json() as { maps: Array<{ id: string }> }
    expect(listBody.maps.some((map) => map.id === mapId)).toBe(true)
  })

  it("applies websocket update and rebroadcasts update to other clients", async () => {
    const { baseHttpUrl, baseWsUrl } = await startServer()
    const mapId = "shared"
    const sender = new WebSocket(`${baseWsUrl}/ws/maps/${mapId}`)
    const receiver = new WebSocket(`${baseWsUrl}/ws/maps/${mapId}`)

    await waitForSocketOpen(sender)
    await waitForSocketOpen(receiver)

    const updatePromise = waitForSocketMessage(
      receiver,
      (message) => message.type === "mapUpdated"
    )

    sender.send(JSON.stringify({ type: "setHex", level: 3, hexId: "1,-1", cell: { type: "forest" } }))

    const updateMessage = await updatePromise
    expect(updateMessage.type).toBe("mapUpdated")
    expect(updateMessage).toMatchObject({
      mapId,
      patch: {
        op: "set",
        path: ["levels", "3", "1,-1"]
      }
    })

    const getResponse = await fetch(`${baseHttpUrl}/maps/${mapId}`)
    expect(getResponse.status).toBe(200)
    const storedMap = await getResponse.json() as { data: Record<string, unknown> }
    expect(storedMap.data).toMatchObject({
      levels: {
        "3": {
          "1,-1": { type: "forest" }
        }
      }
    })

    sender.close()
    receiver.close()
  })
})
