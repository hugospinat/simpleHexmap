import {
  boolean,
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  integer,
} from "drizzle-orm/pg-core";
import type { MapOperation } from "../../../src/core/protocol/index.js";

export const workspaceRole = pgEnum("workspace_role", [
  "owner",
  "gm",
  "player",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    username: text("username").notNull(),
    usernameNormalized: text("username_normalized").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    usernameNormalizedUnique: uniqueIndex(
      "users_username_normalized_unique",
    ).on(table.usernameNormalized),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("sessions_token_hash_unique").on(
      table.tokenHash,
    ),
    userIndex: index("sessions_user_id_idx").on(table.userId),
  }),
);

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceRole("role").notNull(),
    tokenColor: text("token_color").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.workspaceId, table.userId] }),
    userIndex: index("workspace_members_user_id_idx").on(table.userId),
  }),
);

export const maps = pgTable(
  "maps",
  {
    id: uuid("id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    nextSequence: integer("next_sequence").notNull(),
  },
  (table) => ({
    workspaceIndex: index("maps_workspace_id_idx").on(table.workspaceId),
  }),
);

export const hexCells = pgTable(
  "hex_cells",
  {
    mapId: uuid("map_id")
      .notNull()
      .references(() => maps.id, { onDelete: "cascade" }),
    q: integer("q").notNull(),
    r: integer("r").notNull(),
    terrain: text("terrain").notNull(),
    hidden: boolean("hidden").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.mapId, table.q, table.r] }),
    hexIndex: index("hex_cells_map_hex_idx").on(table.mapId, table.q, table.r),
  }),
);

export const features = pgTable(
  "features",
  {
    mapId: uuid("map_id")
      .notNull()
      .references(() => maps.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    kind: text("kind").notNull(),
    q: integer("q").notNull(),
    r: integer("r").notNull(),
    hidden: boolean("hidden").notNull(),
    gmLabel: text("gm_label"),
    playerLabel: text("player_label"),
    labelRevealed: boolean("label_revealed").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.mapId, table.id] }),
    mapHexIndex: index("features_map_hex_idx").on(
      table.mapId,
      table.q,
      table.r,
    ),
  }),
);

export const rivers = pgTable(
  "rivers",
  {
    mapId: uuid("map_id")
      .notNull()
      .references(() => maps.id, { onDelete: "cascade" }),
    q: integer("q").notNull(),
    r: integer("r").notNull(),
    edge: integer("edge").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.mapId, table.q, table.r, table.edge] }),
    hexIndex: index("rivers_map_hex_idx").on(table.mapId, table.q, table.r),
  }),
);

export const roads = pgTable(
  "roads",
  {
    mapId: uuid("map_id")
      .notNull()
      .references(() => maps.id, { onDelete: "cascade" }),
    q: integer("q").notNull(),
    r: integer("r").notNull(),
    edges: integer("edges").array().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.mapId, table.q, table.r] }),
    hexIndex: index("roads_map_hex_idx").on(table.mapId, table.q, table.r),
  }),
);

export const factions = pgTable(
  "factions",
  {
    mapId: uuid("map_id")
      .notNull()
      .references(() => maps.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    name: text("name").notNull(),
    color: text("color").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.mapId, table.id] }),
    mapIndex: index("factions_map_id_idx").on(table.mapId),
  }),
);

export const factionTerritories = pgTable(
  "faction_territories",
  {
    mapId: uuid("map_id")
      .notNull()
      .references(() => maps.id, { onDelete: "cascade" }),
    q: integer("q").notNull(),
    r: integer("r").notNull(),
    factionId: text("faction_id").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.mapId, table.q, table.r] }),
    factionIndex: index("faction_territories_faction_idx").on(
      table.mapId,
      table.factionId,
    ),
    factionFk: foreignKey({
      columns: [table.mapId, table.factionId],
      foreignColumns: [factions.mapId, factions.id],
      name: "faction_territories_map_faction_fk",
    }).onDelete("cascade"),
  }),
);

export const mapTokens = pgTable(
  "map_tokens",
  {
    mapId: uuid("map_id")
      .notNull()
      .references(() => maps.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    q: integer("q").notNull(),
    r: integer("r").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.mapId, table.userId] }),
    mapIndex: index("map_tokens_map_id_idx").on(table.mapId),
  }),
);

export const opLog = pgTable(
  "op_log",
  {
    mapId: uuid("map_id")
      .notNull()
      .references(() => maps.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    operationId: text("operation_id").notNull(),
    sourceClientId: text("source_client_id").notNull(),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id),
    operation: jsonb("operation").notNull().$type<MapOperation>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.mapId, table.sequence] }),
    operationIdUnique: uniqueIndex("op_log_map_operation_id_unique").on(
      table.mapId,
      table.operationId,
    ),
    sequenceIndex: index("op_log_map_sequence_idx").on(
      table.mapId,
      table.sequence,
    ),
  }),
);
