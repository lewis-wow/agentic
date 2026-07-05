# AGENTS.md — packages/api

## Purpose

The **framework-agnostic core** for `apps/api`: domain schemas, business-logic services, exceptions, and validation helpers — everything about `apps/api`'s behavior that has no dependency on Hono. `apps/api` itself is only the Hono wiring on top: routes, middleware, and the server entrypoint. See [Architecture & Data Flow](../../docs/specification/architecture.md).

This is also the **contract layer** between `apps/api` (producer) and its consumers (`apps/dashboard`, `packages/sdk-node`, etc.) for the `.` (schemas) export specifically.

## Required Context Loading

- @docs/standards/typescript.md
- @docs/standards/effect.md
- @docs/specification/effect-schema.md
- @docs/specification/error-handling.md

## Subpath Exports

This package has multiple entry points (`package.json`'s `exports` map), matching `@repo/auth`'s `./roles`/`./jwt` convention — import the specific subpath you need rather than only the root:

| Import                 | Source                    | Contents                                                                                                                                                                                        |
| ---------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@repo/api`            | `src/index.ts`            | Request/response/param/query schemas — the contract layer. Zero runtime dependencies beyond `effect`.                                                                                           |
| `@repo/api/events`     | `src/events/index.ts`     | `flagEmitter` (live SSE broadcast singleton), its `FlagStreamEvent` type, and `FlagEventService` (durable replay). See [ADR-0021](../../docs/adr/0021-flag-event-bus-lives-in-packages-api.md). |
| `@repo/api/exceptions` | `src/exceptions/index.ts` | `Exception` subclasses thrown by services and routes.                                                                                                                                           |
| `@repo/api/services`   | `src/services/index.ts`   | Business-logic service classes (DI-based, one per resource).                                                                                                                                    |
| `@repo/api/validation` | `src/validation/index.ts` | Framework-agnostic decode helpers (`decodeOrThrow`), usable outside Hono.                                                                                                                       |

**The root `.` export stays dependency-free on purpose** (no `@repo/prisma`, no `@repo/auth`) — it's imported by the dashboard and SDK packages, which have no business needing a database client type in their dependency graph. `./services`, `./exceptions`, and `./events` _do_ depend on `@repo/prisma`/`@repo/enums`/`@repo/exception` — that's fine, because nothing outside `apps/api` imports those subpaths.

Every resource's schemas split across `<name>.ts` (main models + their `FromPrisma` transforms) and `<name>.dto.ts` (request bodies, path params, query strings, endpoint response envelopes) — see [Schema File Organization](../../docs/specification/schema-file-organization.md). Per-file/directory purpose is documented as a comment at the top of each file, not here — see the root `AGENTS.md`'s "No Source Layout sections" rule.

## Rules — Schemas (`.`)

- **Every request body, response shape, path param, and query string used by `apps/api` must be defined here** as an Effect `Schema.Struct` — including schemas as small as `Schema.Struct({ flagId: Schema.String })`. Never define an HTTP-facing schema inline inside a route handler in `apps/api`, even a one-off one.
- **Response schemas that decode straight from a Prisma query result use `Schema.transform`**, named `<Thing>FromPrisma`, pairing a raw schema (matching the Prisma row's actual shape — real `Date` instances, nested relations) with the plain wire schema. Use `IsoDateFromPrisma` (`schemas/prisma.ts`) for every date field on the raw side. See [Effect Schema for Requests and Responses](../../docs/specification/effect-schema.md) for the full pattern and when to skip it (no restructuring needed → decode the wire schema directly; excess Prisma columns are dropped automatically).
- **Always export both the schema and its inferred type together:**
  ```ts
  export const FlagConfigSchema = Schema.Struct({ ... });
  export type FlagConfig = Schema.Schema.Type<typeof FlagConfigSchema>;
  ```
- **Domain consts and enums** (e.g. `FLAG_TYPE`) live here alongside their schemas if they are part of the public contract. Never place them in `packages/enums` — that package is for infrastructure-level enums only.
- The `.` export has no runtime dependencies beyond `effect`. Never import `@repo/prisma` or `@repo/auth` into anything reachable from `src/index.ts` — that's what `./services` and `./exceptions` are for.
- Exports are maintained via a barrelsby barrel at `src/index.ts`. After adding a new schema, run `pnpm barrels` from the repo root (scoped: `cd packages/api && npx barrelsby --config ../../.barrelsby.json -d src` — running it unscoped from the repo root currently fails on an unrelated broken symlink).

## Rules — Services (`./services`)

- **Framework-agnostic business logic, one class per resource** — no Hono import, ever, anywhere under `src/services/`. A service must be constructible and callable from a plain Node script, a different transport, or a test, with zero awareness that Hono exists.
- **Plain classes with manual constructor DI**, not `Effect.Service`, not a DI framework. A service takes exactly one constructor parameter, an `Options` object (per `docs/standards/typescript.md`'s `LoggerOptions` pattern), holding its dependencies:

  ```ts
  export type FlagServiceOptions = {
    prisma: PrismaClient;
    emitFlagEvent: EmitFlagEvent;
  };

  export class FlagService {
    constructor(private readonly options: FlagServiceOptions) {}
  }
  ```

- **Dependencies are always injected, never imported as singletons.** This includes app-specific runtime infrastructure like an event emitter: don't `import { emitFlagEvent } from 'apps/api/...'` (that would make this package depend on the app, inverting the dependency direction) — define the dependency's shape as a local type (see `EmitFlagEvent` in `FlagService.ts`) and let the caller (`apps/api`'s route handler) pass its concrete implementation. The same goes for `prisma`: take the `PrismaClient` type, never import the `@repo/prisma` singleton.
- **Service methods throw `Exception` subclasses** from `../exceptions/index.js` directly — there is no Effect failure channel in the service layer. Effect is used here only for `Schema` validation, not control flow.
- `apps/api`'s route handlers construct the service (passing the real `prisma` singleton and the real `emitFlagEvent`), call one method, and translate the result — or a thrown `Exception` via `.toResponse()` — into an HTTP response. See `apps/api/AGENTS.md`.
- **This is a piloted convention, not yet applied to every resource.** `FlagService` is the reference implementation; most routes still inline their logic (see `apps/api/AGENTS.md`). Extract a resource's route into a service opportunistically, not as a prerequisite for unrelated changes.

## Rules — Exceptions (`./exceptions`)

- One file per `Exception` subclass, exported from `src/exceptions/index.ts`. See [Error Handling with Exception Classes](../../docs/specification/error-handling.md) for the full convention (`HttpException`, `.toResponse()`, status codes).
- Exceptions live here — not in `apps/api/src/exceptions/` — because both the framework-agnostic `services/` layer and `apps/api`'s Hono routes throw them; `apps/api` can depend on `packages/api`, but not the other way around.

## Rules — Validation (`./validation`)

- `decodeOrThrow(schema)` is for validating input **outside** an HTTP request/response cycle — a service method, a background job, a future non-Hono transport. It decodes via the schema and throws `RequestValidationFailed` on failure, matching the HTTP-layer behavior without any Hono dependency.
- The Hono-specific half — wiring a schema to `@hono/standard-validator`'s `sValidator` as route middleware — cannot live here (it produces a Hono `Handler`) and stays in `apps/api/src/validation.ts`. See [Effect Schema for Requests and Responses](../../docs/specification/effect-schema.md).
