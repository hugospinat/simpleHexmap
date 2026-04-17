import { deserializeWorld, serializeWorld } from "@/domain/world/worldSerialization";
import type { World } from "@/domain/world/world";
import type { MapSocketMessage } from "@/shared/mapProtocol";

type MapSocketOptions = {
  mapId: string;
  onWorld: (world: World, updatedAt?: string) => void;
};

const DEFAULT_LOCAL_WS_URL = "ws://localhost:3001/ws";

function getSocketUrl(): string {
  const configured = import.meta.env.VITE_WS_URL?.trim();

  if (configured) {
    return configured;
  }

  if (window.location.hostname === "localhost" && window.location.port === "5173") {
    return DEFAULT_LOCAL_WS_URL;
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/ws`;
}

export function openMapSocket({ mapId, onWorld }: MapSocketOptions) {
  const socket = new WebSocket(getSocketUrl());

  socket.addEventListener("open", () => {
    const payload: MapSocketMessage = {
      type: "join_map",
      mapId
    };
    socket.send(JSON.stringify(payload));
  });

  socket.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(String(event.data)) as MapSocketMessage;

      if (data.type === "map_state") {
        onWorld(deserializeWorld(data.map.world), data.map.updatedAt);
        return;
      }

      if (data.type === "map_update" && data.mapId === mapId) {
        onWorld(deserializeWorld(data.world), data.updatedAt);
      }
    } catch {
      // ignore malformed messages
    }
  });

  return {
    sendMapUpdate(world: World) {
      if (socket.readyState !== WebSocket.OPEN) {
        return;
      }

      const payload: MapSocketMessage = {
        type: "map_update",
        mapId,
        world: serializeWorld(world)
      };
      socket.send(JSON.stringify(payload));
    },
    close() {
      socket.close();
    }
  };
}
