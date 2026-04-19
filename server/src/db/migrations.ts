import { postgresClient } from "./client.js";

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY,
    legacy_id text,
    username text NOT NULL,
    username_normalized text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
  )`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS legacy_id text`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_username_normalized_unique ON users (username_normalized)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_legacy_id_unique ON users (legacy_id) WHERE legacy_id IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash text NOT NULL,
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL,
    revoked_at timestamptz
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_hash_unique ON sessions (token_hash)`,
  `CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id)`,
  `CREATE TABLE IF NOT EXISTS workspace_groups (
    id uuid PRIMARY KEY,
    owner_user_id uuid NOT NULL REFERENCES users(id),
    name text NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS workspace_groups_owner_user_id_idx ON workspace_groups (owner_user_id)`,
  `CREATE TABLE IF NOT EXISTS workspace_group_members (
    workspace_group_id uuid NOT NULL REFERENCES workspace_groups(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role text NOT NULL,
    PRIMARY KEY (workspace_group_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS workspace_group_members_user_id_idx ON workspace_group_members (user_id)`,
  `CREATE TABLE IF NOT EXISTS workspaces (
    id uuid PRIMARY KEY,
    workspace_group_id uuid,
    legacy_id text,
    owner_user_id uuid NOT NULL REFERENCES users(id),
    name text NOT NULL,
    settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    next_sequence integer NOT NULL DEFAULT 1
  )`,
  `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS workspace_group_id uuid`,
  `DO $$ BEGIN
    ALTER TABLE workspaces
    ADD CONSTRAINT workspaces_workspace_group_id_fk
    FOREIGN KEY (workspace_group_id)
    REFERENCES workspace_groups(id)
    ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE UNIQUE INDEX IF NOT EXISTS workspaces_legacy_id_unique ON workspaces (legacy_id) WHERE legacy_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS workspaces_owner_user_id_idx ON workspaces (owner_user_id)`,
  `CREATE INDEX IF NOT EXISTS workspaces_workspace_group_id_idx ON workspaces (workspace_group_id)`,
  `CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role text NOT NULL,
    PRIMARY KEY (workspace_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS workspace_members_user_id_idx ON workspace_members (user_id)`,
  `CREATE TABLE IF NOT EXISTS hex_cells (
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    q integer NOT NULL,
    r integer NOT NULL,
    terrain text NOT NULL,
    hidden integer NOT NULL,
    updated_at timestamptz NOT NULL,
    PRIMARY KEY (workspace_id, q, r)
  )`,
  `CREATE INDEX IF NOT EXISTS hex_cells_workspace_hex_idx ON hex_cells (workspace_id, q, r)`,
  `CREATE TABLE IF NOT EXISTS features (
    id text PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    kind text NOT NULL,
    q integer NOT NULL,
    r integer NOT NULL,
    visibility text NOT NULL,
    override_terrain_tile integer NOT NULL,
    gm_label text,
    player_label text,
    label_revealed integer NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS features_workspace_hex_idx ON features (workspace_id, q, r)`,
  `CREATE INDEX IF NOT EXISTS features_workspace_id_idx ON features (workspace_id)`,
  `CREATE TABLE IF NOT EXISTS rivers (
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    q integer NOT NULL,
    r integer NOT NULL,
    edge integer NOT NULL,
    PRIMARY KEY (workspace_id, q, r, edge)
  )`,
  `CREATE INDEX IF NOT EXISTS rivers_workspace_hex_idx ON rivers (workspace_id, q, r)`,
  `CREATE TABLE IF NOT EXISTS roads (
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    q integer NOT NULL,
    r integer NOT NULL,
    edges integer[] NOT NULL,
    PRIMARY KEY (workspace_id, q, r)
  )`,
  `CREATE INDEX IF NOT EXISTS roads_workspace_hex_idx ON roads (workspace_id, q, r)`,
  `CREATE TABLE IF NOT EXISTS factions (
    id text PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    color text NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS factions_workspace_id_idx ON factions (workspace_id)`,
  `CREATE TABLE IF NOT EXISTS faction_territories (
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    q integer NOT NULL,
    r integer NOT NULL,
    faction_id text NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
    PRIMARY KEY (workspace_id, q, r)
  )`,
  `CREATE INDEX IF NOT EXISTS faction_territories_faction_id_idx ON faction_territories (faction_id)`,
  `CREATE TABLE IF NOT EXISTS map_tokens (
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    q integer NOT NULL,
    r integer NOT NULL,
    color text NOT NULL,
    PRIMARY KEY (workspace_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS map_tokens_workspace_id_idx ON map_tokens (workspace_id)`,
  `CREATE TABLE IF NOT EXISTS op_log (
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    sequence integer NOT NULL,
    operation_id text NOT NULL,
    source_client_id text NOT NULL,
    actor_user_id uuid NOT NULL REFERENCES users(id),
    operation jsonb NOT NULL,
    created_at timestamptz NOT NULL,
    PRIMARY KEY (workspace_id, sequence)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS op_log_workspace_operation_id_unique ON op_log (workspace_id, operation_id)`,
  `CREATE INDEX IF NOT EXISTS op_log_workspace_sequence_idx ON op_log (workspace_id, sequence)`,
  `INSERT INTO workspace_groups (id, owner_user_id, name, created_at, updated_at)
   SELECT w.id, w.owner_user_id, w.name, w.created_at, w.updated_at
   FROM workspaces w
   WHERE NOT EXISTS (
     SELECT 1
     FROM workspace_groups g
     WHERE g.id = w.id
   )`,
  `UPDATE workspaces
   SET workspace_group_id = id
   WHERE workspace_group_id IS NULL`,
  `INSERT INTO workspace_group_members (workspace_group_id, user_id, role)
   SELECT DISTINCT
     COALESCE(w.workspace_group_id, w.id),
     wm.user_id,
     CASE WHEN wm.user_id = w.owner_user_id THEN 'owner' ELSE wm.role END
   FROM workspace_members wm
   INNER JOIN workspaces w ON w.id = wm.workspace_id
   ON CONFLICT (workspace_group_id, user_id) DO NOTHING`,
  `INSERT INTO workspace_group_members (workspace_group_id, user_id, role)
   SELECT DISTINCT
     COALESCE(w.workspace_group_id, w.id),
     w.owner_user_id,
     'owner'
   FROM workspaces w
   ON CONFLICT (workspace_group_id, user_id) DO NOTHING`
];

export async function runDatabaseMigrations(): Promise<void> {
  for (const statement of statements) {
    await postgresClient.unsafe(statement);
  }
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
