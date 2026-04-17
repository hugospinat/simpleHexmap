import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { addTile, createInitialWorld, getLevelMap } from "../src/domain/world/world";
import { deserializeWorld, serializeWorld } from "../src/domain/world/worldSerialization";
import { createMapServer, type MapServerInstance } from "./createServer";

const activeServers: MapServerInstance[] = [];
const tempDirs: string[] = [];

afterEach(async () => {
  while (activeServers.length > 0) {
    await activeServers.pop()?.close();
  }

  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

async function startServer() {
  const directory = await mkdtemp(join(tmpdir(), "simple-hexmap-server-"));
  tempDirs.push(directory);
  const server = await createMapServer({ dataDirectory: directory, port: 0 });
  activeServers.push(server);
  return server;
}

describe("map server", () => {
  it("rejects invalid map ids", async () => {
    const server = await startServer();
    const response = await fetch(`${server.origin}/maps/not-a-valid-id`);
    expect(response.status).toBe(404);
  });

  it("creates and loads a map", async () => {
    const server = await startServer();
    const createResponse = await fetch(`${server.origin}/maps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alpha" })
    });
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json() as { id: string; name: string; updatedAt: string };

    const listResponse = await fetch(`${server.origin}/maps`);
    const listed = await listResponse.json() as Array<{ id: string }>;
    expect(listed.some((entry) => entry.id === created.id)).toBe(true);

    const mapResponse = await fetch(`${server.origin}/maps/${created.id}`);
    const loaded = await mapResponse.json() as { name: string };
    expect(loaded.name).toBe("Alpha");
  });

  it("imports a map from JSON", async () => {
    const server = await startServer();
    const world = addTile(createInitialWorld(3), 3, { q: 1, r: -1 }, "forest");
    const response = await fetch(`${server.origin}/maps/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Imported",
        json: serializeWorld(world)
      })
    });

    expect(response.status).toBe(201);
    const imported = await response.json() as { id: string };

    const mapResponse = await fetch(`${server.origin}/maps/${imported.id}`);
    const map = await mapResponse.json() as { world: unknown };
    const deserialized = getLevelMap(deserializeWorld(map.world), 3);
    expect(deserialized.has("1,-1")).toBe(true);
  });

  it("broadcasts websocket updates for joined map clients", async () => {
    const server = await startServer();
    const createResponse = await fetch(`${server.origin}/maps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Realtime" })
    });
    const created = await createResponse.json() as { id: string };

    const wsOrigin = server.origin.replace("http://", "ws://");
    const first = new WebSocket(`${wsOrigin}/ws`);
    const second = new WebSocket(`${wsOrigin}/ws`);

    await Promise.all([
      new Promise<void>((resolve) => first.once("open", () => resolve())),
      new Promise<void>((resolve) => second.once("open", () => resolve()))
    ]);

    await new Promise<void>((resolve) => {
      let joined = 0;
      const onMessage = () => {
        joined += 1;
        if (joined === 2) {
          first.off("message", onMessage);
          second.off("message", onMessage);
          resolve();
        }
      };
      first.on("message", onMessage);
      second.on("message", onMessage);
      first.send(JSON.stringify({ type: "join_map", mapId: created.id }));
      second.send(JSON.stringify({ type: "join_map", mapId: created.id }));
    });

    const updatedWorld = serializeWorld(addTile(createInitialWorld(3), 3, { q: 2, r: 0 }, "mountain"));
    const receivedUpdate = new Promise<{ world: unknown }>((resolve) => {
      second.on("message", (raw) => {
        const message = JSON.parse(String(raw)) as { type: string; world?: unknown };
        if (message.type === "map_update") {
          resolve({ world: message.world });
        }
      });
    });

    first.send(JSON.stringify({ type: "map_update", mapId: created.id, world: updatedWorld }));
    const message = await receivedUpdate;
    expect(message.world).toEqual(updatedWorld);
  });
});
