# AGENTS.md — apps/api

## Role

`apps/api` is the **single source of truth** for all data in the monorepo. It is the only service that reads or writes the database. Every other layer (dashboard, bff, SDK clients) must go through this service.

**This app is the Hono transport only.** Schemas, exceptions, validation helpers, and business-logic services live in the sibling `packages/api` and have zero Hono dependency — see `packages/api/AGENTS.md`. If you're writing code that doesn't need `hono`, `c: Context`, or a `Handler`, it almost certainly belongs there instead of here.

## Required Context Loading

Before writing, refactoring, or reviewing any code here, read:

- @docs/standards/typescript.md
- @docs/standards/hono.md
- @docs/standards/effect.md
- @docs/standards/prisma.md

## Source Layout

```text
src/
  auth/middleware.ts   # JWT verification middleware — applied to all routes
  routes/              # Hono route handlers — thin: auth narrowing, call a service, return its result
  events/              # Internal event emitter (app-specific runtime infra — not in packages/api, see below)
  validation.ts        # validate(target, schema) — Hono-specific sValidator wiring around @repo/api schemas
  env.ts               # Effect Schema env validation (validated at startup)
  index.ts             # Hono app entry point
```

Exceptions (`@repo/api/exceptions`) and business-logic services (`@repo/api/services`) live in `packages/api`, not here — see `packages/api/AGENTS.md`.

Routes: `flags.ts` (mounted at `/projects/:projectId/flags`), `projects.ts` (mounted at `/projects` — list/create are non-project-scoped, detail/delete are project-scoped), `environments.ts` (mounted at `/projects/:projectId/environments`), `apiKeys.ts` (mounted at `/projects/:projectId/api-keys`), `sdk.ts` (mounted at `/v1`, for SDK clients).

Non-project-scoped routes (`/projects` list+create) receive a `MeJwtClaims` token (`{ userId, systemRole }`, no `projectId`) rather than `ProjectJwtClaims` — narrow with `isSdkClaims` and a `'projectId' in auth` check the same way `flags.ts` does, not by assuming every claims object has a `projectId`.

## Rules

- **No session cookies or API keys.** This service only understands RS256 JWTs issued by either BFF layer. JWT verification is wired via `src/auth/middleware.ts`.
- **All Prisma access lives here.** No other app or package may import `@repo/prisma` and query the database.
- **All business logic lives in `apps/api`'s domain** (there is no business logic in the BFF layers) — but the logic itself is written framework-agnostically in `packages/api/src/services/` (`@repo/api/services`), not in route handlers, and not anywhere under `apps/api/src/`. Route handlers narrow auth claims, construct the service with real dependencies (`prisma`, `emitFlagEvent`, ...), call one service method, and translate the result (or thrown `Exception`) into an HTTP response. They do not call Prisma directly, run field validation, build transactions, or emit events themselves.
  - **This is a piloted convention, not yet applied everywhere.** `FlagService`, `ProjectService`, `EnvironmentService`, and `SdkService` (all `@repo/api/services`) are wired up as the reference implementations, used by `flags.ts` (partially — see below), `projects.ts`, `environments.ts`, and `sdk.ts`. `apiKeys.ts` predates the convention and still inlines logic in the route handler; extract it opportunistically (e.g. when touching that route for another reason) rather than adding more inline logic to it.
  - See `packages/api/AGENTS.md`'s "Rules — Services" for the constructor-DI shape, the "dependencies are always injected, never a singleton import" rule (including app-specific infra like `emitFlagEvent` — the service defines a local type for it, apps/api passes the real implementation), and how services throw `Exception` subclasses.
  - **Route handlers call the service and let a thrown `Exception` propagate** — they do not wrap the call in `try`/`catch`. `src/index.ts`'s `app.onError` handler catches any `HttpException` reaching it and calls `.toResponse()`, so a service-backed route only needs `await someService.method(args)`; only routes that check auth/authorization inline (e.g. `Forbidden`) still `return new X().toResponse()` directly, because those checks happen before any service call.

- **Every route's input (JSON body, query string, path params) is validated with `validate(target, schema)`** (`src/validation.ts`) using a schema imported from `@repo/api`, and read back with `c.req.valid(target)` — never `c.req.json()`/`c.req.query()`/`c.req.param()` directly, and never a `Schema.Struct` declared inline in a route file. **Every response — including single-resource GETs — is run through `Schema.encodeSync`/`Schema.decodeUnknownSync` before `c.json(...)`**, using a `<Thing>FromPrisma` `Schema.transform` when the Prisma row needs reshaping (dates, flattened relations). See [Effect Schema for Requests and Responses](../../docs/specification/effect-schema.md) for the full convention and the `IsoDateFromPrisma` helper.
- **Every error is an `Exception` subclass** from `@repo/api/exceptions`. Never call `c.json()` directly with a status code. In a route that doesn't call a service (an inline auth check), `return exception.toResponse()`. Everywhere else — inside a service, or in a route that just calls one — `throw exception` and let `app.onError` (`src/index.ts`) convert it.

## Adding a New Route

1. Define the request/response schemas (including path param and query string schemas) in `packages/api/src/schemas/` and re-export from its barrel — see [Effect Schema for Requests and Responses](../../docs/specification/effect-schema.md).
2. Add or extend the resource's service class in `packages/api/src/services/` (`@repo/api/services`) with the operation's logic (validation, Prisma access, transactions, audit events, SSE emission) — see "Adding a New Service" below.
3. Add the Hono route handler in `src/routes/`: `validate(target, schema)` for every input, narrow auth claims, construct the service with real dependencies, call the service method, and encode the result through its response schema (or return `.toResponse()` on a thrown `Exception`).
4. Add any new error cases as `Exception` subclasses in `packages/api/src/exceptions/` (`@repo/api/exceptions`) — only for conditions a schema can't express (see the linked doc).

## Adding a New Service

Full convention lives in `packages/api/AGENTS.md`'s "Rules — Services". Create `packages/api/src/services/<Resource>Service.ts` as a plain class taking one `Options` constructor parameter:

```ts
import type { PrismaClient } from '@repo/prisma';

import { FlagKeyConflict, FlagNotFound } from '../exceptions/index.js';

export type FlagServiceOptions = {
  prisma: PrismaClient;
};

export type UpdateFlagEnvironmentArgs = {
  flagId: string;
  environmentId: string;
  projectId: string;
  userId: string;
  status?: 'active' | 'inactive';
  type?: FlagType;
  rollout?: number;
  rules?: TargetingRule[];
};

export class FlagService {
  constructor(private readonly options: FlagServiceOptions) {}

  async updateEnvironment(args: UpdateFlagEnvironmentArgs): Promise<FlagState> {
    // validation, Prisma access via this.options.prisma, transaction,
    // audit event, SSE emission — throw Exception subclasses on failure
  }

  // create, rename, remove, archive, unarchive, list, detail, auditLog, ...
}
```

Export it from `packages/api/src/services/index.ts`. In `apps/api`, construct the service once per request (or at module scope with the real `prisma` singleton, mirroring how `prisma` itself is already a module-level instance) — e.g. `const flagService = new FlagService({ prisma, emitFlagEvent });` — and call its methods from the route handler. If the service needs app-specific runtime infra (like this app's SSE event emitter), give it a locally-defined structural type in the service file rather than importing the concrete apps/api module — see `EmitFlagEvent` in `FlagService.ts`. Tests construct their own instance with a fake dependency where needed, and live in `packages/api/__tests__/unit/services/` (see `docs/specification/testing.md`).

## Adding a New Exception

Create a new file in `packages/api/src/exceptions/` and export it from `packages/api/src/exceptions/index.ts`:

```ts
import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class FlagNotFound extends HttpException {
  static readonly status = HttpStatusCode.NOT_FOUND_404;
  static readonly code = 'FlagNotFound';
  static readonly message = 'Flag not found.';
}
```

Extend `HttpException` (not the plain `Exception` base) — it adds `.toResponse()`, which every route handler in this app returns directly. Import it into `apps/api` via `@repo/api/exceptions`.

## API Documentation (OpenAPI)

`GET /openapi.json` and `GET /docs` are wired in `src/index.ts`, but the document itself is generated ahead of time by `src/scripts/generate-openapi.ts` (which calls into `packages/api/src/openapi.ts`) into `src/generated/openapi.json` (gitignored) — the running server only imports and serves that static file, it never calls the generator itself. See [OpenAPI Generation](../../docs/specification/openapi.md) for the full convention, including how to add a new endpoint and how to produce a standalone static bundle (`pnpm build:openapi-static`).

## Environment Variables

Validated at startup in `src/env.ts` via Effect `Schema.Struct`. Add new vars to both `src/env.ts` and the app's `.env.*` files.

## Commands

```bash
pnpm dev          # start in watch mode (from repo root)
pnpm build        # build to dist/
pnpm lint
pnpm check-types
```
