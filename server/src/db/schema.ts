import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import type { MapOperation } from "../../../src/core/protocol/index.js";

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  legacyId: text("legacy_id"),
  username: text("username").notNull(),
  usernameNormalized: text("username_normalized").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
}, (table) => ({
  usernameNormalizedUnique: uniqueIndex("users_username_normalized_unique").on(table.usernameNormalized)
  ,
  legacyIdUnique: uniqueIndex("users_legacy_id_unique").on(table.legacyId)
}));

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true })
}, (table) => ({
  tokenHashUnique: uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
  userIndex: index("sessions_user_id_idx").on(table.userId)
}));

export const workspaceGroups = pgTable("workspace_groups", {
  id: uuid("id").primaryKey(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
}, (table) => ({
  ownerIndex: index("workspace_groups_owner_user_id_idx").on(table.ownerUserId)
}));

export const workspaceGroupMembers = pgTable("workspace_group_members", {
  workspaceGroupId: uuid("workspace_group_id").notNull().references(() => workspaceGroups.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull()
}, (table) => ({
  pk: primaryKey({ columns: [table.workspaceGroupId, table.userId] }),
  userIndex: index("workspace_group_members_user_id_idx").on(table.userId)
}));

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey(),
  workspaceGroupId: uuid("workspace_group_id").references(() => workspaceGroups.id, { onDelete: "cascade" }),
  legacyId: text("legacy_id"),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  settings: jsonb("settings").notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  nextSequence: integer("next_sequence").notNull()
}, (table) => ({
  legacyIdUnique: uniqueIndex("workspaces_legacy_id_unique").on(table.legacyId),
  ownerIndex: index("workspaces_owner_user_id_idx").on(table.ownerUserId),
  workspaceGroupIndex: index("workspaces_workspace_group_id_idx").on(table.workspaceGroupId)
}));

export const workspaceMembers = pgTable("workspace_members", {
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull()
}, (table) => ({
  pk: primaryKey({ columns: [table.workspaceId, table.userId] }),
  userIndex: index("workspace_members_user_id_idx").on(table.userId)
}));

export const hexCells = pgTable("hex_cells", {
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  q: integer("q").notNull(),
  r: integer("r").notNull(),
  terrain: text("terrain").notNull(),
  hidden: integer("hidden").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
}, (table) => ({
  pk: primaryKey({ columns: [table.workspaceId, table.q, table.r] }),
  hexIndex: index("hex_cells_workspace_hex_idx").on(table.workspaceId, table.q, table.r)
}));

export const features = pgTable("features", {
  id: text("id").primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  q: integer("q").notNull(),
  r: integer("r").notNull(),
  visibility: text("visibility").notNull(),
  overrideTerrainTile: integer("override_terrain_tile").notNull(),
  gmLabel: text("gm_label"),
  playerLabel: text("player_label"),
  labelRevealed: integer("label_revealed").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
}, (table) => ({
  workspaceHexIndex: index("features_workspace_hex_idx").on(table.workspaceId, table.q, table.r),
  workspaceIndex: index("features_workspace_id_idx").on(table.workspaceId)
}));

export const rivers = pgTable("rivers", {
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  q: integer("q").notNull(),
  r: integer("r").notNull(),
  edge: integer("edge").notNull()
}, (table) => ({
  pk: primaryKey({ columns: [table.workspaceId, table.q, table.r, table.edge] }),
  hexIndex: index("rivers_workspace_hex_idx").on(table.workspaceId, table.q, table.r)
}));

export const roads = pgTable("roads", {
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  q: integer("q").notNull(),
  r: integer("r").notNull(),
  edges: integer("edges").array().notNull()
}, (table) => ({
  pk: primaryKey({ columns: [table.workspaceId, table.q, table.r] }),
  hexIndex: index("roads_workspace_hex_idx").on(table.workspaceId, table.q, table.r)
}));

export const factions = pgTable("factions", {
  id: text("id").primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull()
}, (table) => ({
  workspaceIndex: index("factions_workspace_id_idx").on(table.workspaceId)
}));

export const factionTerritories = pgTable("faction_territories", {
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  q: integer("q").notNull(),
  r: integer("r").notNull(),
  factionId: text("faction_id").notNull().references(() => factions.id, { onDelete: "cascade" })
}, (table) => ({
  pk: primaryKey({ columns: [table.workspaceId, table.q, table.r] }),
  factionIndex: index("faction_territories_faction_id_idx").on(table.factionId)
}));

export const mapTokens = pgTable("map_tokens", {
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  q: integer("q").notNull(),
  r: integer("r").notNull(),
  color: text("color").notNull()
}, (table) => ({
  pk: primaryKey({ columns: [table.workspaceId, table.userId] }),
  workspaceIndex: index("map_tokens_workspace_id_idx").on(table.workspaceId)
}));

export const opLog = pgTable("op_log", {
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  operationId: text("operation_id").notNull(),
  sourceClientId: text("source_client_id").notNull(),
  actorUserId: uuid("actor_user_id").notNull().references(() => users.id),
  operation: jsonb("operation").notNull().$type<MapOperation>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
}, (table) => ({
  pk: primaryKey({ columns: [table.workspaceId, table.sequence] }),
  operationIdUnique: uniqueIndex("op_log_workspace_operation_id_unique").on(table.workspaceId, table.operationId),
  sequenceIndex: index("op_log_workspace_sequence_idx").on(table.workspaceId, table.sequence)
}));
