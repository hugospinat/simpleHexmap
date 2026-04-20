# Copilot Instructions - hexmap_editor

This file defines coding discipline and contribution standards for the repository. It is intentionally architecture-independent.

For project architecture, subsystem responsibilities, runtime flow, persistence workflow, and design choices, always read `README.md` first.

## Read this first

- Use `README.md` as the source of truth for architecture and technical choices.
- Do not encode architecture-specific guidance here when it belongs in the README.
- If a code change affects architecture, boundaries, runtime setup, migrations, or system behavior, update the README in the same change.

## Core engineering standards

- Prefer clarity over cleverness.
- Make data flow explicit.
- Avoid hidden side effects.
- Keep mutations and transitions obvious.
- Fix problems at the correct boundary instead of layering ad hoc patches.
- Remove dead code while refactoring.
- Preserve determinism where the code depends on ordering, replay, or reduction.
- Treat public types, wire contracts, and persisted formats as explicit compatibility surfaces.

## Module design rules

- Keep modules focused on one strong responsibility.
- Split large files before they become hard to reason about.
- The 600-line threshold is only a rough smell, not a target or permission slip.
- If a file has any real logical separation available, split it even when it is well below 600 lines.
- If a file approaches the limit, extract one coherent slice instead of adding more unrelated logic.
- Prefer composition over catch-all controller modules.
- Keep pure logic in pure modules and keep I/O at boundaries.
- Avoid utility dumping grounds with vague names like `helpers`, `misc`, or `data`.

## Naming rules

- Use explicit, intention-revealing names.
- Name by domain meaning, not by implementation accident.
- Avoid overloaded terms for distinct concepts.
- If a name is ambiguous, rename it rather than document around it.

## Refactoring rules

- Refactor toward smaller seams with tests.
- Prefer narrow extractions over broad rewrites unless a broad rewrite is clearly safer.
- Do not preserve historical complexity just because it already exists.
- When a module mixes responsibilities, separate orchestration from pure logic.
- When a representation boundary exists, keep conversions explicit and testable.

## Frontend and React rules

- Prefer small hooks and components.
- Keep React hooks as orchestration layers, not domain containers.
- Prefer readable local state to premature abstraction.
- Use functional state updates when sequencing matters.
- Guard against stale closures in async or realtime code.
- Avoid duplicated sources of truth in UI state.
- Preserve established interaction patterns unless the change intentionally redesigns them.

## Server and API rules

- Validate all external input.
- Keep routes thin and predictable.
- Keep authorization explicit.
- Keep persistence logic separate from transport handling.
- Fail fast on invalid configuration and invalid requests.
- Prefer deterministic responses and stable error handling.

## Persistence and migration rules

- Use the repository migration workflow documented in `README.md`.
- Do not introduce ad hoc schema mutation paths outside the documented workflow.
- Treat persistence changes as reviewable, explicit changes.
- Keep data migrations and schema changes understandable and auditable.

## Testing rules

- Add or update targeted tests when behavior changes.
- Run the relevant checks after refactors.
- Prefer small, verifiable refactors over broad unverified rewrites.
- When fixing a regression, add a test near the broken seam when practical.

## Documentation maintenance

- Keep this file up to date when coding standards or contributor expectations change.
- Keep `README.md` up to date when architecture or technical choices change.
- Significant refactors should usually update both files: README for architecture, this file for coding discipline if the working rules changed.
- Do not let either document drift from the codebase.
