# AGENTS.md — packages/types

## Purpose

Fundamental TypeScript utility types shared across the entire monorepo. Contains only types — zero runtime code.

## Required Context Loading

- @.docs/typescript.md

## Rules

- **Zero runtime code.** Every export must be a `type` or `interface`. If runtime logic is needed, it belongs in `packages/utils`.
- **Only truly universal utilities.** Do not add types that are specific to a domain (flags, auth, projects). Those belong in the relevant domain package.
- `ValueOfEnum` is the required way to derive value unions from `as const` enum objects throughout the codebase. Never use manual unions or `typeof` directly for this purpose.
- Exports are maintained via a barrelsby barrel at `src/index.ts`. After adding a new export, run `pnpm barrels` from the repo root.
