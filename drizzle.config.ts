import { defineConfig } from "drizzle-kit";
import { resolveServerDatabaseConfig } from "./server/src/serverConfig";

const databaseConfig = resolveServerDatabaseConfig(process.env);

export default defineConfig({
  dialect: "postgresql",
  out: "./server/src/db/migrations",
  schema: "./server/src/db/schema.ts",
  dbCredentials: {
    url: databaseConfig.url,
  },
});
