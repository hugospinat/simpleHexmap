import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const defaultDatabaseUrl = "postgres://simplehex:simplehex@localhost:5432/simplehex";

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL?.trim() || defaultDatabaseUrl;
}

export const postgresClient = postgres(getDatabaseUrl(), {
  max: Number(process.env.DB_POOL_SIZE ?? 10)
});

export const db = drizzle(postgresClient, { schema });

export type AppDb = typeof db;
