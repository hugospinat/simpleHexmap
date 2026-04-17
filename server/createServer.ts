import express from "express";
import { createServer, type Server as HttpServer } from "node:http";
import { resolve } from "node:path";
import { WebSocket, WebSocketServer } from "ws";
import { deserializeWorld, serializeWorld } from "../src/domain/world/worldSerialization";
import type { MapSocketMessage } from "../src/shared/mapProtocol";
import { FileMapStore } from "./mapStore";

type StartServerOptions = {
  dataDirectory?: string;
  port?: number;
};

type SocketSession = {
  mapId: string | null;
};

function sendMessage(socket: WebSocket, payload: MapSocketMessage) {
  socket.send(JSON.stringify(payload));
}

export async function createMapServer({ dataDirectory, port = 3001 }: StartServerOptions = {}) {
  const store = new FileMapStore(dataDirectory ?? resolve(process.cwd(), "server", "data"));
  await store.init();

  const app = express();
  app.use(express.json({ limit: "10mb" }));

  app.get("/maps", async (_request, response) => {
    response.json(await store.listMaps());
  });

  app.post("/maps", async (request, response) => {
    const payload = request.body as { name?: string; world?: unknown };
    const world = payload.world ? deserializeWorld(payload.world) : undefined;
    const created = await store.createMap(payload.name ?? "Nouvelle map", world);
    response.status(201).json({ id: created.id, name: created.name, updatedAt: created.updatedAt });
  });

  app.get("/maps/:id", async (request, response) => {
    try {
      response.json(await store.readMap(request.params.id));
    } catch {
      response.status(404).json({ message: "Map not found." });
    }
  });

  app.put("/maps/:id", async (request, response) => {
    try {
      const payload = request.body as { name?: string; world?: unknown };
      const world = payload.world ? deserializeWorld(payload.world) : undefined;
      const updated = await store.updateMap(request.params.id, { name: payload.name, world });
      response.json({ id: updated.id, name: updated.name, updatedAt: updated.updatedAt });
      broadcastMapUpdate(updated.id, updated.world, undefined, updated.updatedAt);
    } catch {
      response.status(404).json({ message: "Map not found." });
    }
  });

  app.post("/maps/import", async (request, response) => {
    try {
      const payload = request.body as { name?: string; json?: unknown };
      const imported = await store.importMap(payload.name, payload.json);
      response.status(201).json({ id: imported.id, name: imported.name, updatedAt: imported.updatedAt });
    } catch {
      response.status(400).json({ message: "Invalid JSON import payload." });
    }
  });

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ noServer: true });
  const sessions = new Map<WebSocket, SocketSession>();

  function broadcastMapUpdate(mapId: string, world: unknown, excluded?: WebSocket, updatedAt?: string) {
    const serializedWorld = serializeWorld(deserializeWorld(world));

    for (const [socket, session] of sessions.entries()) {
      if (socket === excluded || session.mapId !== mapId || socket.readyState !== WebSocket.OPEN) {
        continue;
      }

      sendMessage(socket, {
        type: "map_update",
        mapId,
        world: serializedWorld,
        updatedAt
      });
    }
  }

  wss.on("connection", (socket) => {
    sessions.set(socket, { mapId: null });

    socket.on("message", async (messageData) => {
      try {
        const message = JSON.parse(String(messageData)) as MapSocketMessage;

        if (message.type === "join_map") {
          const map = await store.readMap(message.mapId);
          sessions.set(socket, { mapId: map.id });
          sendMessage(socket, {
            type: "map_state",
            map
          });
          return;
        }

        if (message.type === "map_update") {
          const session = sessions.get(socket);

          if (!session?.mapId || session.mapId !== message.mapId) {
            return;
          }

          const updated = await store.updateMap(message.mapId, { world: deserializeWorld(message.world) });
          broadcastMapUpdate(message.mapId, updated.world, socket, updated.updatedAt);
        }
      } catch {
        // ignore malformed ws messages
      }
    });

    socket.on("close", () => {
      sessions.delete(socket);
    });
  });

  httpServer.on("upgrade", (request, socket, head) => {
    if (request.url !== "/ws") {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  await new Promise<void>((resolveStart) => {
    httpServer.listen(port, resolveStart);
  });

  const address = httpServer.address();

  if (!address || typeof address === "string") {
    throw new Error("Unable to determine server address.");
  }

  return {
    app,
    close: async () => {
      await new Promise<void>((resolveClose) => {
        wss.clients.forEach((client) => client.close());
        wss.close(() => resolveClose());
      });
      await new Promise<void>((resolveClose) => {
        httpServer.close(() => resolveClose());
      });
    },
    httpServer,
    origin: `http://127.0.0.1:${address.port}`,
    store,
    wss
  };
}

export type MapServerInstance = Awaited<ReturnType<typeof createMapServer>>;
export type { HttpServer };
