# hexmap_editor

Technical architecture guide for the repository. This file is the source of truth for runtime structure, persistence workflow, wire contracts, and system boundaries. Repository coding discipline belongs in `.github/copilot-instructions.md`; repository architecture belongs here.

## Documentation contract

- Update this README in the same change whenever architecture, persistence shape, transport contracts, runtime flow, or migration workflow changes.
- Keep `.github/copilot-instructions.md` architecture-independent.
- If the README and code disagree, the README is stale and must be rewritten immediately.

## Product summary

`hexmap_editor` is a collaborative hex-map editor for tabletop and strategy workflows with authoritative multiplayer sync.

Core capabilities:

- terrain editing
- fog of war
- features and labels
- roads and rivers
- factions and territories
- per-user token placement
- per-workspace-member token color
- GM and player visibility modes
- PostgreSQL persistence through Drizzle
- authoritative ordered updates over WebSocket

## Non-negotiable model

The rewrite is intentionally breaking. The codebase now has one canonical persisted document model and one explicit overlay view model.

Canonical representations:

- `MapState`: runtime editor world used by tools, reducers, and rendering
- `MapDocument`: canonical persisted document used for import/export and SQL materialization
- `MapView`: `{ document, tokenPlacements }`, the explicit server and client snapshot shape
- `MapOperation`: semantic document mutation contract
- `MapTokenOperation`: semantic token overlay mutation contract

Hard rules:

- `MapState` is not persisted directly.
- `MapDocument` does not contain tokens.
- token placement lives only in `tokenPlacements`.
- token color lives only on `WorkspaceMember.tokenColor`.
- there are no compatibility shims for the removed legacy document model.
- player-visible state is filtered on the server before transport.
- the server owns sequence numbers and authoritative ordering.

## Canonical data model

### Document

`MapDocument` is the only persisted map content shape.

It contains:

- `version`
- `tiles`
- `features`
- `rivers`
- `roads`
- `factions`
- `factionTerritories`

Important document rules:

- tiles carry both `terrain` and `hidden`
- features carry `hidden: boolean`; there is no feature `visibility` string anymore
- terrain override is derived from visible feature kind; there is no persisted per-feature `overrideTerrainTile` boolean
- factions are map-local records identified by `(mapId, id)` in persistence
- document JSON is the import/export contract

### Overlay view

`MapView` is the authoritative snapshot shape used across HTTP and WebSocket reads.

```ts
type MapView = {
  document: MapDocument;
  tokenPlacements: MapTokenPlacement[];
};
```

Token rules:

- `MapTokenPlacement` contains only `userId`, `q`, and `r`
- token color is resolved from workspace membership, not token rows
- player snapshots include only placements on visible cells

### Workspace membership

Workspace membership is now the single authority for access and token presentation.

`WorkspaceMember` contains:

- `userId`
- `username`
- `role`
- `tokenColor`

There is no `ownerUserId` field in workspace summaries, map summaries, or map snapshots. Ownership is represented by the membership role `owner`.

## Operation surface

The live protocol is intentionally smaller than before. Removed operation families are not supported.

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

Removed operations:

- `paint_cells`
- `set_cells_hidden`
- `assign_faction_cells`
- `set_feature_hidden`
- `rename_map`

Current design choices:

- editor commands emit only canonical operations
- runtime reducers and document reducers apply the same document operation contract
- token placement is reduced separately from document content
- history inverts semantic batches rather than persistence-shaped diffs

## Editor interaction rules

- GM fog editing and GM token placement are separate tool tabs
- fog left drag edits terrain hidden state only
- fog right drag edits feature hidden state only
- the first valid fog target in a drag locks the whole gesture to hide or reveal
- road add and road remove both work by dragging between neighboring hexes; removal clears only the traversed connections
- visible feature kinds that support terrain override always replace terrain art; hidden features never do

## End-to-end flow

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

## Dependency direction

```text
ui -> editor/app/render -> core
server -> core
```

Rules:

- `src/core` stays pure and independent from React, DOM, Pixi, HTTP, WebSocket, and database APIs.
- `src/editor` orchestrates interaction but does not define the domain model.
- `src/render` consumes derived world data and never owns business rules.
- `server/src` owns transport, authorization, persistence, visibility filtering, and broadcast.

## Server and transport

### HTTP contract

Authentication endpoints:

- `GET /api/auth/me`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`

Workspace endpoints:

- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/workspaces/:workspaceId`
- `PATCH /api/workspaces/:workspaceId`
- `DELETE /api/workspaces/:workspaceId`
- `GET /api/workspaces/:workspaceId/members`
- `POST /api/workspaces/:workspaceId/members`
- `PATCH /api/workspaces/:workspaceId/members/:userId`
- `DELETE /api/workspaces/:workspaceId/members/:userId`
- `GET /api/workspaces/:workspaceId/maps`
- `POST /api/workspaces/:workspaceId/maps`
- `POST /api/workspaces/:workspaceId/maps/import`

Map endpoints:

- `GET /api/maps/:mapId?role=gm|player`
- `PATCH /api/maps/:mapId`
- `DELETE /api/maps/:mapId`
- `GET /api/maps/:mapId/export`

Map reads return a map record whose content surface is:

- `document`
- `tokenPlacements`
- `workspaceMembers`
- `currentUserRole`

Exports return `{ name, document }`.

### WebSocket contract

Socket endpoint:

- `GET /api/maps/:mapId/ws`

Socket lifecycle:

1. client connects with the auth session cookie
2. server sends `sync_snapshot`
3. client sends `map_operation` or `map_token_update`
4. server validates, authorizes, persists, and sequences
5. GM clients receive ordered `map_operation_applied` and `map_token_updated`
6. player clients receive filtered `sync_snapshot` refreshes instead of hidden-capable operations

Important messages:

- `sync_snapshot`
- `map_operation`
- `map_operation_applied`
- `map_token_update`
- `map_token_updated`
- `map_token_error`
- `sync_error`

`sync_snapshot` contains:

- `lastSequence`
- `updatedAt`
- `workspaceMembers`
- `document`
- `tokenPlacements`

## Persistence model

Persistence is fully aligned to the canonical model.

Key schema decisions:

- `workspaces` only stores workspace metadata
- `workspace_members` stores role and `token_color`
- `maps.workspace_id` is required
- `map_tokens` stores token placement only
- `hex_cells.hidden`, `features.hidden`, and `features.label_revealed` are booleans
- `features` and `factions` use composite primary keys `(map_id, id)`
- `faction_territories` references factions through `(map_id, faction_id)`

Explicit removals:

- `map_members`
- `workspace_member_tokens`
- `legacy_id`
- `owner_user_id`
- `maps.settings`

## Visibility and security

- auth is cookie/session-based
- every HTTP and WebSocket request is role-checked on the server
- player payloads are filtered before serialization
- hidden tiles, hidden features, hidden-overlay roads, rivers, faction territories, and hidden-cell tokens do not leak to player payloads
- GM-only labels are stripped from player-facing features

Primary implementation seam:

- `server/src/repositories/mapVisibility.ts`

## Migration workflow

Schema changes use generated Drizzle SQL, then manual review.

Workflow:

1. Update `server/src/db/schema.ts`
2. Run `npm run db:generate`
3. Review the generated SQL under `server/src/db/migrations/`
4. If migration history is intentionally reset, regenerate a single fresh `0000` baseline from the current schema and discard older migration files
5. Apply the reviewed migration set only after review

Current repository state:

- migration history is reset to a single baseline generated from the current canonical schema
- the baseline already reflects the post-rewrite model, so there is no retained legacy upgrade chain in-repo

When the migration history is reset like this, treat the generated `0000` as the new canonical starting point for fresh databases.

## Verification workflow

Primary checks:

- `npm run typecheck`
- `npm run build:server`
- `npm test`
- `npm run db:generate`

Smoke scripts live under `scripts/` and are expected to speak the canonical operation and snapshot contract.

## Practical boundaries

- Fix problems at the representation boundary where they originate.
- Keep document logic in document reducers and codecs.
- Keep token overlay logic separate from document persistence.
- Keep visibility filtering strictly server-side.
- Do not reintroduce owner fields, legacy IDs, or compatibility adapters into the transport layer.
- GM-only labels and hidden content must not be hidden only by rendering tricks
- player token, terrain, feature, road, river, and faction visibility all derive from filtered server payloads

Relevant server boundaries:

- `server/src/repositories/mapVisibility.ts`
- `server/src/syncSnapshotService.ts`
- `server/src/sessionDelivery.ts`

## Persistence model

Persistence is PostgreSQL-first with generated Drizzle migrations.

Canonical workflow:

```bash
npm run db:generate
npm run db:migrate
```

Rules:

- edit `server/src/db/schema.ts`
- generate SQL migrations into `server/src/db/migrations/`
- apply them with Drizzle Kit
- let server startup run the Drizzle runtime migrator against the generated migration folder
- do not use hand-maintained runtime SQL arrays as the canonical migration path
- do not treat `drizzle-kit push` as the repository workflow

## Local development

Install dependencies:

```bash
npm install
```

Start the development database:

```bash
docker compose -f docker-compose.dev.yml up -d postgres
```

Default database URL:

```text
postgres://simplehex:simplehex@localhost:5432/simplehex
```

If startup fails with `password authentication failed for user "simplehex"`, the most common cause is that `localhost:5432` is owned by some other PostgreSQL instance instead of the repository container.

Start the backend:

```bash
npm.cmd run server
```

Start the frontend:

```bash
npm.cmd run dev
```

## Smoke scripts

The scripts under `scripts/` authenticate, provision an isolated workspace and map, run their checks, and delete their temporary workspace on exit.

Available scripts:

- `scripts/ws-sequence-smoke.mjs`
- `scripts/ws-multi-client-check.mjs`
- `scripts/ws-stress.mjs`
- `scripts/ws-player-visibility-smoke.mjs`

These scripts assume the backend is already running.

## Verification

Mandatory repository checks after meaningful changes:

```bash
npm run typecheck
npm test
npm run build:server
```

Current structural rules:

- no critical source file should exceed 600 lines without an explicit temporary reason
- keep sync, editor, and Pixi orchestration moving toward smaller modules
- keep server routes thin and keep persistence logic out of transport handlers

## Active refactor direction

Priority themes still in flight:

- keep finishing the semantic operation rollout at every boundary
- continue decomposing sync, editor, and Pixi orchestration hotspots
- keep visibility filtering strictly server-side
- keep workspace and map terminology aligned across code, docs, and storage
- reduce dead terminology and dead adapters instead of preserving historical naming compromises
