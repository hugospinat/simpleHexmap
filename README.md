# hexmap_editor

A collaborative hex-map editor for tabletop and strategy workflows with authoritative multiplayer sync.

This README is the source of truth for runtime structure, persistence workflow, wire contracts, and system boundaries. Repository coding discipline belongs in `.github/copilot-instructions.md`. Update this file in the same change whenever architecture, persistence shape, transport contracts, runtime flow, or migration workflow changes. If the README and code disagree, the README is stale and must be corrected immediately.

## Table of contents

- [Overview](#overview)
- [Quick start](#quick-start)
- [Development commands](#development-commands)
- [Core architecture](#core-architecture)
- [Data model and operations](#data-model-and-operations)
- [Server and transport contracts](#server-and-transport-contracts)
- [Persistence and migrations](#persistence-and-migrations)
- [Security and visibility](#security-and-visibility)
- [Repository structure](#repository-structure)
- [Verification and smoke tests](#verification-and-smoke-tests)
- [Appendix: roadmap](#appendix-roadmap)

---

## Overview

`hexmap_editor` is a real-time collaborative hex-map editor designed for GM-led tabletop and strategy sessions.

Core capabilities:

- terrain editing
- fog of war
- tiered map features
- roads and rivers
- factions and territories
- per-user token placement with per-member token color
- GM and player visibility modes with server-side filtering
- PostgreSQL persistence through Drizzle ORM
- authoritative ordered updates over WebSocket

---

## Quick start

Requirements: Node.js, Docker.

```bash
npm install
docker compose -f docker-compose.dev.yml up -d postgres
npm run server   # start the backend
npm run dev      # start the frontend
```

Default database URL:

```text
postgres://simplehex:simplehex@localhost:5432/simplehex
```

If startup fails with `password authentication failed for user "simplehex"`, the most common cause is that `localhost:5432` is owned by a different PostgreSQL instance instead of the repository container.

---

## Development commands

| Command | Purpose |
|---|---|
| `npm run dev` | Vite frontend dev server |
| `npm run server` | Express backend dev server |
| `npm run typecheck` | TypeScript type check |
| `npm test` | Vitest test suite |
| `npm run build` | Production frontend build |
| `npm run build:server` | Production backend build |
| `npm run db:generate` | Generate Drizzle SQL migrations from schema |
| `npm run db:migrate` | Apply generated migrations |

---

## Core architecture

The codebase has one canonical persisted document model and one explicit overlay view model. There are no compatibility shims for any removed legacy shapes.

### Canonical representations

| Type | Purpose |
|---|---|
| `MapState` | Runtime editor world used by tools, reducers, and rendering. Never persisted directly. |
| `MapDocument` | Canonical persisted document used for import/export and SQL materialization. Does not contain tokens. |
| `MapView` | `{ document, tokenPlacements }` — the explicit snapshot shape used across HTTP and WebSocket. |
| `MapOperation` | Semantic document mutation contract. |
| `MapTokenOperation` | Semantic token overlay mutation contract. |

Token placement lives only in `tokenPlacements`. Token color lives only on `WorkspaceMember.tokenColor`. The server owns sequence numbers and authoritative ordering. Player-visible state is filtered on the server before transport.

### End-to-end flow

GM edit flow:

```text
User gesture
-> editor tool / gesture state
-> domain command
-> MapOperation[] or MapTokenOperation
-> optimistic client session state
-> WebSocket send
-> server validation and authorization
-> transactional persistence
-> authoritative ordered broadcast
-> client authoritative apply or snapshot replace
-> render from MapState plus token overlay
```

Player view flow:

```text
HTTP or WebSocket request
-> server role lookup
-> server visibility filtering
-> filtered MapView snapshot
-> client session replace
-> render only visible state
```

### Editor interaction rules

- GM fog editing and GM token placement are separate tool tabs
- fog left drag edits terrain hidden state only; fog right drag edits feature hidden state only
- the first valid fog target in a drag locks the whole gesture to hide or reveal
- feature placement and removal happen only on level 3; higher levels are derived read-only views
- feature left click places the selected feature kind and never opens a popup editor
- road add and road remove both work by dragging between neighboring hexes; removal clears only the traversed connections
- visible feature kinds that support terrain override always replace terrain art; hidden features never do

### Contribution boundaries

- Fix problems at the representation boundary where they originate.
- Keep document logic in document reducers and codecs.
- Keep token overlay logic separate from document persistence.
- Keep visibility filtering strictly server-side.
- Do not reintroduce owner fields, legacy IDs, or compatibility adapters into the transport layer.
- GM-only labels and hidden content must not be hidden only by rendering tricks; they must be absent from player payloads.

Relevant server seams:

- `server/src/repositories/mapVisibility.ts`
- `server/src/syncSnapshotService.ts`
- `server/src/sessionDelivery.ts`

---

## Data model and operations

### Document

`MapDocument` is the only persisted map content shape. Document JSON version `2` is the import/export contract.

Fields:

- `version`
- `tiles` — each tile carries `terrain` and `hidden`
- `features` — each record carries `kind`, `featureLevel`, and `hidden: boolean`
- `rivers`
- `roads`
- `factions` — map-local records identified by `(mapId, id)` in persistence
- `factionTerritories`

Important rules:

- feature labels do not exist anywhere in the canonical model
- source features are placed only on level 3; level 2 shows feature levels 2–3; level 1 shows feature level 3 only
- terrain override is derived from visible feature kind; there is no persisted per-feature `overrideTerrainTile` boolean

### Overlay view

`MapView` is the authoritative snapshot shape used across HTTP and WebSocket reads:

```ts
type MapView = {
  document: MapDocument;
  tokenPlacements: MapTokenPlacement[];
};
```

`MapTokenPlacement` contains only `userId`, `q`, and `r`. Token color is resolved from workspace membership. Player snapshots include only placements on visible cells.

### Workspace membership

`WorkspaceMember` is the single authority for access and token presentation:

- `userId`
- `username`
- `role`
- `tokenColor`

There is no `ownerUserId` field anywhere in the transport layer. Ownership is represented by the membership role `owner`.

### Operation surface

Canonical document operations:

- terrain: `set_tiles`
- factions: `set_faction_territories`, `add_faction`, `update_faction`, `remove_faction`
- features: `add_feature`, `update_feature`, `remove_feature`
- rivers: `add_river_data`, `remove_river_data`
- roads: `set_road_edges`

Canonical token operations:

- `set_map_token`
- `remove_map_token`
- `set_map_token_color`

Removed operations (not supported):

- `paint_cells`, `set_cells_hidden`, `assign_faction_cells`, `set_feature_hidden`, `rename_map`

Design rules:

- editor commands emit only canonical operations
- runtime reducers and document reducers apply the same document operation contract
- token placement is reduced separately from document content
- history inverts semantic batches rather than persistence-shaped diffs

---

## Server and transport contracts

### HTTP endpoints

**Auth**

- `GET /api/auth/me`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`

**Operational visibility**

- `GET /healthz` — returns `{ status, startedAt, timestamp, uptimeMs }`
- `GET /metrics` — returns lightweight JSON with process memory, HTTP limits, active WebSocket session/client counts, and realtime rate-limit budgets

**Invitations**

- `GET /api/invites/:inviteToken`
- `POST /api/invites/:inviteToken/join`

**Workspaces**

- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/workspaces/:workspaceId`
- `PATCH /api/workspaces/:workspaceId`
- `DELETE /api/workspaces/:workspaceId`
- `GET /api/workspaces/:workspaceId/members`
- `POST /api/workspaces/:workspaceId/members`
- `PATCH /api/workspaces/:workspaceId/members/:userId`
- `DELETE /api/workspaces/:workspaceId/members/:userId`
- `GET /api/workspaces/:workspaceId/invites`
- `POST /api/workspaces/:workspaceId/invites`
- `DELETE /api/workspaces/:workspaceId/invites/:inviteId`
- `GET /api/workspaces/:workspaceId/maps`
- `POST /api/workspaces/:workspaceId/maps`
- `POST /api/workspaces/:workspaceId/maps/import`

**Maps**

- `GET /api/maps/:mapId?role=gm|player` — returns `{ document, tokenPlacements, workspaceMembers, currentUserRole }`
- `PATCH /api/maps/:mapId`
- `DELETE /api/maps/:mapId`
- `GET /api/maps/:mapId/export` — returns `{ name, document }`

### WebSocket contract

Endpoint: `GET /api/maps/:mapId/ws`

Lifecycle:

1. client connects with the auth session cookie
2. server sends `sync_snapshot`
3. client sends `map_operation` or `map_token_update`
4. server validates, authorizes, persists, and sequences
5. GM clients receive ordered `map_operation_applied` and `map_token_updated`
6. player clients receive filtered `sync_snapshot` refreshes instead of hidden-capable operations

Messages:

- `sync_snapshot` — contains `lastSequence`, `updatedAt`, `workspaceMembers`, `document`, `tokenPlacements`
- `map_operation`
- `map_operation_applied`
- `map_token_update`
- `map_token_updated`
- `map_token_error`
- `sync_error`

### Operational hardening knobs

The default server profile is intentionally conservative for low-resource single-instance deployments:

| Environment variable | Default |
|---|---|
| `HEXMAP_MAX_HTTP_BODY_BYTES` | `5242880` (5 MiB) |
| `HEXMAP_MAX_WS_PAYLOAD_BYTES` | `262144` (256 KiB) |
| `HEXMAP_MAX_WS_CONNECTIONS` | `100` |
| `HEXMAP_MAX_WS_CONNECTIONS_PER_MAP` | `24` |
| `HEXMAP_WS_OPERATION_RATE_LIMIT_MAX_ATTEMPTS` | `120` |
| `HEXMAP_WS_OPERATION_RATE_LIMIT_WINDOW_MS` | `1000` |
| `HEXMAP_REQUEST_TIMEOUT_MS` | `15000` |
| `HEXMAP_HEADERS_TIMEOUT_MS` | `20000` |
| `HEXMAP_KEEP_ALIVE_TIMEOUT_MS` | `5000` |

---

## Persistence and migrations

Persistence is PostgreSQL-first with generated Drizzle migrations.

### Schema decisions

- `workspaces` stores only workspace metadata
- `workspace_members` stores role and `token_color`
- `workspace_invites` stores hashed invite tokens, expiry, revocation, and usage counters
- `maps.workspace_id` is required
- `map_tokens` stores token placement only
- `hex_cells.hidden`, `features.hidden`, and `features.label_revealed` are booleans
- `features` and `factions` use composite primary keys `(map_id, id)`
- `faction_territories` references factions through `(map_id, faction_id)`

Explicit removals: `map_members`, `workspace_member_tokens`, `legacy_id`, `owner_user_id`, `maps.settings`.

### Migration workflow

1. Edit `server/src/db/schema.ts`
2. Run `npm run db:generate` — generates SQL into `server/src/db/migrations/`
3. Review the generated SQL
4. Run `npm run db:migrate` — applies migrations; server startup also runs the Drizzle runtime migrator automatically

Rules:

- do not use hand-maintained runtime SQL arrays as the canonical migration path
- do not treat `drizzle-kit push` as the repository workflow
- if migration history is intentionally reset, regenerate a single fresh `0000` baseline and discard older files

Current state: migration history is reset to a single baseline reflecting the post-rewrite model. Treat the generated `0000` as the canonical starting point for fresh databases.

---

## Security and visibility

Authentication is cookie/session-based.

- cookie-authenticated browser access is same-origin; `HEXMAP_ALLOWED_ORIGINS` gates explicit origin validation and non-credentialed CORS responses only
- mutating HTTP requests and WebSocket upgrades require an allowed `Origin` or same-origin `Referer`
- every HTTP and WebSocket request is role-checked on the server
- player payloads are filtered before serialization — hidden tiles, features, roads, rivers, faction territories, and hidden-cell tokens never reach player clients
- GM-only labels are stripped from player-facing feature records
- login and signup are rate-limited by both client IP and normalized username; invite join and WebSocket upgrades remain rate-limited per client IP (process-local, intentional for low-resource deployments)
- accepted WebSocket map and token operations are rate-limited per user within each map session
- structured audit logs cover auth failures, workspace invite lifecycle events, and map deletion
- re-authentication rotates the active session and revokes previously active sessions for the same user
- idle, expired, and revoked sessions are cleaned up opportunistically during auth access and session issuance
- workspace invite links are stored as hashed tokens only, with expiry, usage caps, and explicit revocation
- HTTP bodies are byte-limited before JSON parsing
- WebSocket upgrades are capped globally and per map
- unauthenticated `GET /healthz` and `GET /metrics` expose aggregate process and connection telemetry only; they do not include workspace or user data
- HTTP request, header, and keep-alive timeouts are explicitly bounded

Primary implementation seam: `server/src/repositories/mapVisibility.ts`

---

## Repository structure

```text
src/
  app/
    api/          browser HTTP request helpers and response parsing
    document/     import/export and runtime-document conversion
    sync/         pure sync session state and socket orchestration
  core/
    auth/         shared auth, membership, and role types
    document/     MapDocument codecs and normalization
    geometry/     pure hex math
    map/          MapState, commands, history, views, and reducers
    protocol/     document and token operation contracts
  editor/
    context/      editor-scoped React context
    hooks/        orchestration hooks
    presentation/ editor-facing text helpers
    tools/        gesture state and edit-intent builders
    tokens/       token hit-testing and token UI helpers
  render/
    pixi/         Pixi stage, scene cache, and draw layers
  ui/
    components/   presentation components

server/
  src/
    db/           Drizzle schema and generated migrations
    repositories/ persistence mapping and visibility filtering
    routes/       thin HTTP handlers
    services/     auth and server orchestration helpers
    validation/   HTTP and WebSocket schemas
    wsRoutes.ts   WebSocket entrypoint
    index.ts      server bootstrap

scripts/
  authenticated smoke scripts for sync behavior
```

### Dependency direction

```text
ui -> editor/app/render -> core
server -> core
```

- `src/core` stays pure and independent from React, DOM, Pixi, HTTP, WebSocket, and database APIs.
- `src/editor` orchestrates interaction but does not define the domain model.
- `src/render` consumes derived world data and never owns business rules.
- `server/src` owns transport, authorization, persistence, visibility filtering, and broadcast.
- cross-slice imports outside `core` must use explicit slice entrypoints: `@/app/api`, `@/app/document`, `@/app/sync`, `@/editor/hooks`, `@/editor/context`, `@/render/pixi`, `@/ui/components`.

---

## Verification and smoke tests

### Mandatory checks after meaningful changes

```bash
npm run typecheck
npm test
npm run build:server
npm run db:generate
```

### Structural rules

- no critical source file should exceed 600 lines without an explicit temporary reason
- keep server routes thin and keep persistence logic out of transport handlers
- keep sync, editor, and Pixi orchestration moving toward smaller modules

### Smoke scripts

The scripts under `scripts/` authenticate, provision an isolated workspace and map, run checks, and delete their temporary workspace on exit. They require the backend to be running.

- `scripts/ws-sequence-smoke.mjs`
- `scripts/ws-multi-client-check.mjs`
- `scripts/ws-stress.mjs`
- `scripts/ws-player-visibility-smoke.mjs`

---

## Appendix: roadmap

### Active refactor direction

- finish the semantic operation rollout at every boundary
- continue decomposing sync, editor, and Pixi orchestration hotspots
- keep visibility filtering strictly server-side
- keep workspace and map terminology aligned across code, docs, and storage
- reduce dead terminology and dead adapters

### Product improvement backlog

**Security and server operations**

**Features**

- add autosaved local draft state so reconnects feel instant
- add read-only share links for players joining a prepared view
- obsidian plugin / integration

**Organization**

- keep splitting large sync/editor/render orchestration files into narrower modules
- centralize runtime configuration under `server/src/serverConfig.ts`
- add a dedicated `server/src/services/realtime/` slice if WebSocket orchestration keeps growing
