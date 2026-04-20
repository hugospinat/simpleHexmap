# hexmap_editor

Technical architecture guide for the repository. This file is the source of truth for system structure, subsystem boundaries, runtime workflow, and technical decisions. Repository coding discipline belongs in `.github/copilot-instructions.md`; architecture belongs here.

## Documentation contract

- Update this README whenever architecture, runtime setup, persistence workflow, security boundaries, or major refactor direction changes.
- Keep `.github/copilot-instructions.md` architecture-independent. It should point here for system-specific guidance.
- If this README and the code disagree, treat that as documentation drift and fix it in the same change.

## Product summary

`hexmap_editor` is a collaborative hex-map editor for tabletop and strategy workflows.

Core capabilities:

- terrain editing
- fog of war
- features and labels
- roads and rivers
- factions and territories
- token placement and per-member token color
- GM and player visibility modes
- authoritative live sync over WebSocket
- persisted maps stored in PostgreSQL through Drizzle

## Architectural goals

The repository is moving toward a strict domain-first design.

Non-negotiable goals:

- authoritative server sequencing
- strict ordered operation application
- no GM data leakage into player payloads
- explicit boundaries between domain, transport, persistence, UI, and rendering
- command-first editor writes
- generated SQL migrations as the persistence workflow
- derived render views instead of implicit business logic in Pixi layers

## System invariants

- `MapState` is the runtime editing model, not the persisted document.
- `SavedMapContent` is the persisted document shape, not the editor state.
- `MapOperation` is the mutation and transport contract, not a UI command.
- the server owns authoritative operation sequence numbers.
- remote operations must never be re-emitted as local intent.
- player-visible snapshots must be filtered on the server before transport.
- hidden tiles, features, roads, rivers, faction overlays, and tokens must not leak through player payloads.
- large files must be decomposed before they regrow into mixed-responsibility modules.

## Core representations

The application intentionally keeps separate representations for the same map.

- `MapState`: pure runtime world used by editor logic and rendering
- `SavedMapContent`: serialized document used for import/export and SQL materialization
- `MapOperation`: semantic mutation contract used across client, server, sync, history, and persistence

These representations must not be collapsed into one another.

## Operation model

The live protocol now uses semantic operations instead of older storage-shaped diffs.

Canonical operation families:

- terrain: `paint_cells`, `set_tiles`, `set_cells_hidden`
- factions: `assign_faction_cells`, `set_faction_territories`, `add_faction`, `update_faction`, `remove_faction`
- features: `add_feature`, `set_feature_hidden`, `update_feature`, `remove_feature`
- rivers: `add_river_data`, `remove_river_data`
- roads: `set_road_edges`
- map metadata: `rename_map`
- tokens: `set_map_token`, `remove_map_token`, `set_map_token_color`

Current design choices:

- editor commands emit semantic operations
- `MapState` reducers and `SavedMapContent` reducers both apply the same operation contract
- history inverts semantic batches instead of snapshot diffs
- sync sends one `map_operation` message per operation; the client no longer emits `map_operation_batch`

## End-to-end flow

Normal GM edit flow:

```text
User gesture
-> editor tool / gesture state
-> domain command
-> MapOperation[]
-> local optimistic session state
-> WebSocket send
-> server validation and authorization
-> transactional persistence
-> authoritative ordered broadcast
-> client authoritative apply or resync snapshot
-> Pixi render from derived frame data
```

Normal player view flow:

```text
HTTP or WebSocket request
-> server role lookup
-> server visibility filtering
-> filtered snapshot payload
-> client session replace
-> render only visible terrain-derived content
```

## Repository structure

```text
src/
  app/
    api/          browser HTTP request helpers and response parsing
    document/     browser import/export and runtime-document conversion
    sync/         pure sync session state plus socket orchestration
  core/
    auth/         shared auth and role types
    document/     persisted document codecs and types
    geometry/     pure hex math and edge detection
    map/          world model, commands, history, derived views, reducers
    protocol/     semantic map and token operation contracts
  editor/
    context/      editor-scoped React context
    hooks/        editor orchestration hooks
    presentation/ labels and editor-facing text helpers
    tools/        gesture state and edit-intent builders
    tokens/       token hit-testing and token UI helpers
  render/
    pixi/         Pixi stage, scene cache, render window, and layer drawing
  ui/
    components/   presentation components

server/
  src/
    db/           Drizzle client, schema, and migrations
    repositories/ storage mapping and visibility filtering
    routes/       thin HTTP route handlers
    services/     auth and higher-level server logic
    validation/   HTTP and WebSocket message schemas
    wsRoutes.ts   WebSocket entrypoint
    index.ts      server bootstrap

scripts/
  authenticated smoke scripts for WebSocket and sync behavior
```

## Dependency direction

Dependency flow must stay explicit.

```text
ui -> editor/app/render -> core
server -> core
```

Rules:

- `src/core` must stay pure and independent from React, DOM, Pixi, HTTP, WebSocket, and database APIs.
- `src/editor` may orchestrate React state and domain calls, but should not become the domain itself.
- `src/render` must consume derived world data, not own business rules.
- `server/src` may orchestrate validation, auth, persistence, and broadcast, but should not duplicate shared domain rules already defined in `src/core`.

## Current subsystem responsibilities

### Core

`src/core` contains pure logic and shared contracts.

Key areas:

- `geometry`: axial coordinates, hex keys, line walking, pointer math helpers
- `document`: persisted document types and codec normalization
- `map`: world model, commands, history, level views, and reducers
- `protocol`: semantic operation types, validation, coalescing, content-level application, token operations

Current design choices:

- semantic operations are preferred over low-level storage-shaped mutations
- operation appliers exist both for `MapState` and `SavedMapContent`
- history inverts semantic batches, not full snapshots

### App

`src/app` owns browser integration boundaries.

Key areas:

- `api`: authenticated HTTP contracts and client-side response parsing
- `document`: browser import/export and runtime-document conversion
- `sync`: pure sync session state plus WebSocket orchestration

Current design choices:

- `mapSyncSession.ts` is the pure sync session model
- `useMapSocketSync.ts` is an integration hook that now manages authoritative resync, render patch publication, and token member sync
- workspace and map CRUD flows live in `workspaceApi.ts`; map wire-message types remain shared with sync

### Editor

`src/editor` owns interaction orchestration.

Key areas:

- tool gestures build user intent incrementally
- hooks coordinate camera, keyboard, pointer lifecycle, sync integration, selection state, and preview state
- editor writes are command-first and operation-first, not persistence-first

Current design choices:

- token behavior is isolated in `useTokenControls.ts`
- `useEditorController.ts` remains an orchestration hotspot and should continue shrinking
- `useMapInteraction.ts` remains a pointer-routing hotspot and should continue moving toward smaller intent and gesture modules

### Render

`src/render/pixi` owns Pixi-specific projection and layer drawing.

Render pipeline:

```text
MapState
-> MapLevelView / scene derivation
-> PixiMapSceneCache
-> PixiActiveRenderWindow
-> PixiSceneRenderFrame
-> layer-specific draw functions
```

Current design choices:

- scene data is cached by level
- the active render window limits the rendered working set
- render frame derivation is separate from layer drawing
- renderer resource management is split out of `pixiMapRenderer.ts`

### Server

`server/src` owns transport, authorization, persistence, and authoritative broadcast.

Current design choices:

- HTTP routes are thin and live under `server/src/routes`
- auth is cookie/session-based
- map payload visibility filtering is applied at the server boundary
- GM WebSocket clients receive ordered operation messages
- player WebSocket clients receive filtered `sync_snapshot` refreshes instead of raw hidden-capable operations

## HTTP and WebSocket contract

### HTTP

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

### WebSocket

Socket endpoint:

- `GET /api/maps/:mapId/ws`

Socket lifecycle:

1. client connects with the auth session cookie
2. server sends `sync_snapshot`
3. client sends `map_operation` or `map_token_update`
4. server validates, authorizes, persists, and sequences
5. GM clients receive `map_operation_applied` and `map_token_updated`
6. player clients receive filtered snapshot refreshes when authoritative state changes

Important messages:

- `sync_snapshot`
- `map_operation`
- `map_operation_applied`
- `map_token_update`
- `map_token_updated`
- `map_token_error`
- `sync_error`

Deprecated runtime assumptions that no longer apply:

- no unauthenticated map listing for smoke scripts
- no client-emitted `map_operation_batch`
- no server-emitted `map_operation_batch_applied`

## Security and visibility model

- auth is cookie/session-based
- every HTTP and WebSocket request is role-checked on the server
- player snapshots are visibility-filtered before serialization
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
