import type { MutableRefObject } from "react";
import {
  createMapSocketTransport,
  type MapSocketTransport,
} from "@/app/sync/mapSocketTransport";
import {
  parseMapSyncSocketMessage,
  type ParsedMapSyncMessage,
} from "@/app/sync/mapSyncMessages";
import { logMapSync } from "@/app/sync/mapSyncSupport";

type MapSocketLifecycleOptions = {
  mapId: string;
  onClose: () => void;
  onMessage: (
    parsed: ParsedMapSyncMessage,
    transport: MapSocketTransport,
  ) => void;
  onOpen: () => void;
  socketUrl: string;
  transportRef: MutableRefObject<MapSocketTransport | null>;
};

export function startMapSocketLifecycle({
  mapId,
  onClose,
  onMessage,
  onOpen,
  socketUrl,
  transportRef,
}: MapSocketLifecycleOptions): () => void {
  let disposed = false;
  let reconnectTimer: number | null = null;
  let reconnectAttempt = 0;
  let activeTransport: MapSocketTransport | null = null;

  const clearReconnectTimer = () => {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const connect = () => {
    if (disposed) {
      return;
    }

    if (
      activeTransport &&
      (activeTransport.socket.readyState === WebSocket.CONNECTING ||
        activeTransport.socket.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    const transport = createMapSocketTransport(socketUrl);
    const socket = transport.socket;
    activeTransport = transport;
    transportRef.current = transport;

    socket.onopen = () => {
      if (disposed || transportRef.current !== transport) {
        return;
      }

      reconnectAttempt = 0;
      onOpen();
      logMapSync("open", { mapId, socketUrl });
    };

    socket.onmessage = (event) => {
      if (disposed || transportRef.current !== transport) {
        return;
      }

      onMessage(parseMapSyncSocketMessage(event.data), transport);
    };

    socket.onerror = (event) => {
      if (!disposed && transportRef.current === transport) {
        console.error("[MapSync] error", { event, mapId, socketUrl });
      }
    };

    socket.onclose = (event) => {
      const isCurrentSocket = transportRef.current === transport;

      if (isCurrentSocket) {
        transportRef.current = null;
      }

      if (activeTransport === transport) {
        activeTransport = null;
      }

      if (disposed || !isCurrentSocket) {
        return;
      }

      console.warn("[MapSync] close", {
        code: event.code,
        mapId,
        reason: event.reason,
        socketUrl,
        wasClean: event.wasClean,
      });
      onClose();

      if (disposed) {
        return;
      }

      const delayMs = Math.min(5000, 250 * 2 ** Math.min(reconnectAttempt, 4));
      reconnectAttempt += 1;
      clearReconnectTimer();
      logMapSync("reconnect_scheduled", {
        delayMs,
        mapId,
        reconnectAttempt,
        socketUrl,
      });
      reconnectTimer = window.setTimeout(connect, delayMs);
    };
  };

  reconnectTimer = window.setTimeout(connect, 0);

  return () => {
    disposed = true;
    clearReconnectTimer();
    activeTransport?.close();
    transportRef.current = null;
  };
}
