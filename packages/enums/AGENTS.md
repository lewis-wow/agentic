# AGENTS.md — packages/enums

## Purpose

Shared `as const` enums used across the entire monorepo: `HttpStatusCode` and `NodeEnv`, plus their derived union types.

## Required Context Loading

- @docs/standards/typescript.md

## Rules

- **Always use `HttpStatusCode` when defining `Exception` subclasses.** Never use raw number literals for status codes anywhere in the codebase.
- Key format is `NAME_NNN` — the name part describes the status in UPPER_SNAKE_CASE and the number suffix is the HTTP code (e.g. `BAD_REQUEST_400`, `INTERNAL_SERVER_ERROR_500`).
- Do not add non-standard or custom codes. `HttpStatusCode` must reflect the HTTP specification only.
- This package must have zero runtime dependencies beyond `@repo/types` (which provides `ValueOfEnum`).
- Exports are maintained via a barrelsby barrel at `src/index.ts`. After adding a new export, run `pnpm barrels` from the repo root.
