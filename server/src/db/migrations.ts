import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, postgresClient } from "./client.js";

const migrationsFolder = path.resolve(
  process.cwd(),
  "server/src/db/migrations",
);

export async function runDatabaseMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder });
}

if (process.argv[1]?.endsWith("migrations.js")) {
  runDatabaseMigrations()
    .then(() => {
      console.info("[db] migrations applied.");
      return postgresClient.end();
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
