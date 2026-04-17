import { createServer } from "node:http";
import { createHttpHandler } from "./httpRoutes.js";
import { attachWebSocketRoutes } from "./wsRoutes.js";

function resolvePort() {
  const raw = process.env.PORT;

  if (!raw) {
    return 8787;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 8787;
}

const port = resolvePort();
const server = createServer(createHttpHandler());

attachWebSocketRoutes(server);

server.listen(port, () => {
  console.log(`Map server listening on http://localhost:${port}`);
});

