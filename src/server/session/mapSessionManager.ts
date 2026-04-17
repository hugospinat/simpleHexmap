import { WebSocket } from "ws"

export class MapSessionManager {
  private readonly socketsByMap = new Map<string, Set<WebSocket>>()

  join(mapId: string, socket: WebSocket): void {
    const sockets = this.socketsByMap.get(mapId) ?? new Set<WebSocket>()
    sockets.add(socket)
    this.socketsByMap.set(mapId, sockets)
  }

  leave(mapId: string, socket: WebSocket): void {
    const sockets = this.socketsByMap.get(mapId)

    if (!sockets) {
      return
    }

    sockets.delete(socket)

    if (sockets.size === 0) {
      this.socketsByMap.delete(mapId)
    }
  }

  broadcastToOthers(mapId: string, sender: WebSocket, payload: string): void {
    const sockets = this.socketsByMap.get(mapId)

    if (!sockets) {
      return
    }

    for (const socket of sockets) {
      if (socket === sender || socket.readyState !== WebSocket.OPEN) {
        continue
      }

      socket.send(payload)
    }
  }
}
