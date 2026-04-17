export type MapSocketTransport = {
  close: (code?: number, reason?: string) => void;
  sendJson: (payload: unknown) => void;
  socket: WebSocket;
};

export function createMapSocketTransport(socketUrl: string): MapSocketTransport {
  const socket = new WebSocket(socketUrl);

  return {
    close: (code = 1000, reason = "client_cleanup") => {
      if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
        socket.close(code, reason);
      }
    },
    sendJson: (payload) => {
      socket.send(JSON.stringify(payload));
    },
    socket
  };
}

