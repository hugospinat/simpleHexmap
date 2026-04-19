import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  out: "./server/src/db/migrations",
  schema: "./server/src/db/schema.ts",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://simplehex:simplehex@localhost:5432/simplehex"
  }
});
