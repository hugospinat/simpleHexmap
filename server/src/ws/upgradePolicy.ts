import type { Socket } from "node:net";

const idPatternSource = "[a-zA-Z0-9_-]{1,80}";
export const mapSocketPattern = new RegExp(`^/api/maps/(${idPatternSource})/ws$`);

type UpgradeRejection = {
  reason: string;
  statusCode: number;
};

export function resolveWebSocketUpgradeRejection(input: {
  currentConnections: number;
  currentMapConnections: number;
  maxConnections: number;
  maxConnectionsPerMap: number;
}): UpgradeRejection | null {
  if (input.currentConnections >= input.maxConnections) {
    return {
      reason: "Server is at WebSocket capacity.",
      statusCode: 503,
    };
  }

  if (input.currentMapConnections >= input.maxConnectionsPerMap) {
    return {
      reason: "Map is at WebSocket capacity.",
      statusCode: 503,
    };
  }

  return null;
}

export function rejectUpgrade(
  socket: Socket,
  statusCode: number,
  reason: string,
): void {
  if (socket.writable) {
    const body = `${reason}\n`;
    socket.write(
      `HTTP/1.1 ${statusCode} ${reason}\r\n` +
        "Connection: close\r\n" +
        "Content-Type: text/plain; charset=utf-8\r\n" +
        `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n` +
        body,
    );
  }

  socket.destroy();
}
