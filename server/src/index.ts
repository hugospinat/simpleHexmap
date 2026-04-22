import { createServer } from "node:http";
import { createHttpHandler } from "./httpRoutes.js";
import { attachWebSocketRoutes } from "./wsRoutes.js";
import { runDatabaseMigrations } from "./db/migrations.js";
import { serverLimits } from "./serverConfig.js";

const port = serverLimits.port;
const server = createServer(createHttpHandler());
server.requestTimeout = serverLimits.requestTimeoutMs;
server.headersTimeout = serverLimits.headersTimeoutMs;
server.keepAliveTimeout = serverLimits.keepAliveTimeoutMs;

attachWebSocketRoutes(server);

await runDatabaseMigrations();

server.listen(port, () => {
  console.log(`Map server listening on http://localhost:${port}`);
});
