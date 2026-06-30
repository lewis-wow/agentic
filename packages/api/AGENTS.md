# AGENTS.md — packages/api

## Purpose

Domain schemas for every `apps/api` endpoint. This is the **contract layer** between `apps/api` (producer) and its consumers (`apps/dashboard`, `packages/sdk-node`, etc.).

## Required Context Loading

- @.docs/typescript.md
- @.docs/effect.md

## Source Layout

```text
src/
  schemas/
    flags.ts   # Flag schemas, flag event schemas, FLAG_TYPE const enum
```

## Rules

- **Every request body and response shape used by `apps/api` must be defined here** as an Effect `Schema.Struct`. Never define HTTP contracts inline inside route handlers.
- **Always export both the schema and its inferred type together:**
  ```ts
  export const FlagConfigSchema = Schema.Struct({ ... });
  export type FlagConfig = Schema.Schema.Type<typeof FlagConfigSchema>;
  ```
- **Domain consts and enums** (e.g. `FLAG_TYPE`) live here alongside their schemas if they are part of the public contract. Never place them in `packages/enums` — that package is for infrastructure-level enums only.
- This package has no runtime dependencies beyond `effect`. Never import from `@repo/prisma`, `@repo/auth`, or any app package.
- Exports are maintained via a barrelsby barrel at `src/index.ts`. After adding a new schema, run `pnpm barrels` from the repo root.
