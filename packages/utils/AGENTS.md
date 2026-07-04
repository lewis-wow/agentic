# AGENTS.md — packages/utils

## Purpose

Shared runtime utility functions used across apps and packages. Lightweight helpers with no domain knowledge.

## Required Context Loading

- @docs/standards/typescript.md
- @docs/standards/effect.md

## Rules

- **No domain logic.** If a utility is specific to flags, auth, or any other domain, it belongs in the relevant domain package.
- **`createEnv` is the required way to validate environment variables** in all apps. Each app's `src/env.ts` calls `createEnv` with an Effect Schema struct. Never access `process.env` directly outside of `src/env.ts`.
- Do not add heavy dependencies here. This package must remain cheap to import everywhere.
- Exports are maintained via a barrelsby barrel at `src/index.ts`. After adding a new export, run `pnpm barrels` from the repo root.
