# Copilot Instructions - hexmap_editor

## Project overview

hexmap_editor is a collaborative hex-map editor for tabletop and strategy workflows.
The codebase handles map tiles, terrain, features, roads, rivers, factions, fog of war, GM/player visibility modes, and live map synchronization.

Core concepts used across the project:

- MapState model: hex cells and per-level map data.
- Shared document codec: persisted `SavedMapContent` parsing lives in `src/core/document` and is used by both client and server.
- Incremental operations: map edits are represented as operations, not full world replacements.
- Rendering pipeline: PixiJS scene cache, active render window, overlays, roads/rivers, and feature visuals are drawn separately.
- Visibility model: GM mode and player mode differ, especially for hidden cells.
- Realtime sync: server-authoritative stream with ordered operation application.

## Architectural rules

- Keep domain logic separate from UI logic.
- Keep rendering logic separate from world state logic.
- Treat the server as authoritative for collaborative state.
- Prefer incremental operations/events over full-state rewrites for live updates.
- Avoid hidden side effects; mutations and transitions must be explicit.
- Prefer explicit data flow over implicit coupling.
- Keep pure logic in domain modules and keep I/O at boundaries (UI, server, persistence).

## React and frontend rules

- Prefer small, focused components and hooks.
- Prefer readable local state over premature abstractions.
- Use functional state updates when sequencing matters.
- Avoid stale state bugs in async and realtime paths.
- Avoid duplicated controls or duplicated source of truth in the UI.
- Keep the UI minimal, dense, and practical for map editing workflows.
- Preserve existing interaction patterns unless intentionally changed.

## Realtime and sync rules

- Apply operations in strict order.
- Do not re-emit remote operations (avoid feedback loops).
- Be careful with batching and stale state snapshots.
- Keep WebSocket/session behavior in `src/app/sync/useMapSocketSync.ts` and the pure session model in `src/app/sync/mapSyncSession.ts`; editor controllers should send operations and react to sync status, not own socket lifecycle.
- Prefer correctness first, then optimize.
- Keep sync debug logging targeted, temporary, and behind a debug flag.
- Prefer idempotent operation handling and explicit sequence-based flow.

## Server rules

- Validate all client inputs.
- Keep server logic simple, explicit, and predictable.
- Persist safely (atomic writes and clear failure handling where practical).
- Avoid unnecessary framework complexity.
- Keep map updates incremental where appropriate.
- Use `src/core/document/savedMapCodec.ts` for persisted map normalization instead of duplicating server-only compatibility checks.
- Broadcast authoritative updates in a form clients can apply deterministically.

## Code quality rules

- Prefer clarity over cleverness.
- Remove dead code during refactors.
- Keep naming explicit and intention-revealing.
- Avoid giant files and mixed responsibilities.
- Refactor when a file starts to mix unrelated concerns.
- Editor write paths should be command-first: tools and gestures produce explicit `MapOperation` values, then reducers apply those operations to local preview/authoritative worlds.
- Render paths should use `MapLevelView` for logical derived map reads. Pixi map rendering should go through `src/render/pixi` scene cache and active window, not rebuild viewport frames on every pan/zoom.

### File length rule (explicit)

- No source file should be longer than 600 lines.
- If a file is approaching 600 lines, split it before adding more logic.
- Temporary exceptions are allowed only when splitting would create immediate regression risk; in that case:
  - keep the exception explicit in PR notes or comments,
  - extract one coherent slice in the same or next change,
  - avoid adding unrelated logic to the oversized file.
- For this repository, keep `src/editor/hooks/useEditorController.ts`, `src/editor/hooks/useMapInteraction.ts`, `src/app/sync/useMapSocketSync.ts`, and `src/render/pixi/pixiMapRenderer.ts` moving toward composition of focused controllers rather than regrowing mixed responsibilities.

## UX rules

- Keep editing direct and fast.
- Prefer inline editing when sensible.
- Avoid awkward multi-step workflows.
- Keep GM/player behavior clear and predictable.
- Hidden player information must not leak through rendering (terrain, features, edges, overlays).

## Testing and verification rules

- For behavior changes, add or update targeted tests when practical.
- Run relevant tests after refactors.
- Prefer small, verifiable refactors over broad rewrites.

## Maintenance rule (important)

This file (`.github/copilot-instructions.md`) is a living source of truth and must be updated whenever architecture, conventions, patterns, workflows, or major design decisions change.

Any significant refactor must also update this file if guidance changed.
Do not let this document drift from the real codebase.
