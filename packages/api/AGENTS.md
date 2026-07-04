# AGENTS.md — packages/api

## Purpose

Domain schemas for every `apps/api` endpoint. This is the **contract layer** between `apps/api` (producer) and its consumers (`apps/dashboard`, `packages/sdk-node`, etc.).

## Required Context Loading

- @docs/standards/typescript.md
- @docs/standards/effect.md

## Source Layout

```text
src/
  schemas/
    pagination.ts  # PaginatedResponseSchema helper — the standard { items, total, page, limit } envelope
    prisma.ts      # IsoDateFromPrisma — shared Date<->ISO-string transform for *FromPrisma schemas
    flags.ts       # Flag schemas, flag event schemas, FLAG_TYPE/FLAG_STATUS const enums, route param/query schemas
    auditLog.ts    # Audit log entry + paginated audit log schemas
    users.ts       # User list item + paginated user list schemas, route query schema
    apiKeys.ts     # API key list item + paginated API key list schemas, route param/query schemas
    environments.ts # Environment schema + paginated environment list schemas, route param/query schemas
    members.ts     # Project member list item + paginated member list schema, route param/query schemas
    projects.ts    # Project/environment/member request schemas
  openapi.ts       # Generates the OpenAPI document from the schemas above — see docs/specification/openapi.md
```

## Rules

- **Every request body, response shape, path param, and query string used by `apps/api` must be defined here** as an Effect `Schema.Struct` — including schemas as small as `Schema.Struct({ flagId: Schema.String })`. Never define an HTTP-facing schema inline inside a route handler in `apps/api`, even a one-off one.
- **Response schemas that decode straight from a Prisma query result use `Schema.transform`**, named `<Thing>FromPrisma`, pairing a raw schema (matching the Prisma row's actual shape — real `Date` instances, nested relations) with the plain wire schema. Use `IsoDateFromPrisma` (`schemas/prisma.ts`) for every date field on the raw side. See [Effect Schema for Requests and Responses](../../docs/specification/effect-schema.md) for the full pattern and when to skip it (no restructuring needed → decode the wire schema directly; excess Prisma columns are dropped automatically).
- **Always export both the schema and its inferred type together:**
  ```ts
  export const FlagConfigSchema = Schema.Struct({ ... });
  export type FlagConfig = Schema.Schema.Type<typeof FlagConfigSchema>;
  ```
- **Domain consts and enums** (e.g. `FLAG_TYPE`) live here alongside their schemas if they are part of the public contract. Never place them in `packages/enums` — that package is for infrastructure-level enums only.
- This package has no runtime dependencies beyond `effect`. Never import from `@repo/prisma`, `@repo/auth`, or any app package.
- Exports are maintained via a barrelsby barrel at `src/index.ts`. After adding a new schema, run `pnpm barrels` from the repo root.
