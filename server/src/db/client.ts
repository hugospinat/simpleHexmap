import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverDatabaseConfig } from "../serverConfig.js";
import * as schema from "./schema.js";

export const postgresClient = postgres(serverDatabaseConfig.url, {
  max: serverDatabaseConfig.poolSize,
});

export const db = drizzle(postgresClient, { schema });

export type AppDb = typeof db;
