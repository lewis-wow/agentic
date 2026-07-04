# AGENTS.md — apps/api

## Role

`apps/api` is the **single source of truth** for all data in the monorepo. It is the only service that reads or writes the database. Every other layer (dashboard, bff, SDK clients) must go through this service.

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
  exceptions/          # App-specific Exception subclasses
  routes/              # Hono route handlers — thin: auth narrowing, call a service, return its result
  services/            # Effect.Service business-logic modules, one per resource
  events/              # Internal event emitter
  env.ts               # Effect Schema env validation (validated at startup)
  index.ts             # Hono app entry point
```

Routes: `flags.ts` (mounted at `/projects/:projectId/flags`), `projects.ts` (mounted at `/projects` — list/create are non-project-scoped, detail/delete are project-scoped), `environments.ts` (mounted at `/projects/:projectId/environments`), `members.ts` (mounted at `/projects/:projectId/members`), `users.ts` (mounted at `/users`, owner-only), `sdk.ts` (mounted at `/v1`, for SDK clients).

Non-project-scoped routes (`/projects` list+create, `/users`) receive a `MeJwtClaims` token (`{ userId, systemRole }`, no `projectId`) rather than `ProjectJwtClaims` — narrow with `isSdkClaims` and a `'projectId' in auth` check the same way `flags.ts` does, not by assuming every claims object has a `projectId`.

## Rules

- **No session cookies or API keys.** This service only understands RS256 JWTs issued by either BFF layer. JWT verification is wired via `src/auth/middleware.ts`.
- **All Prisma access lives here.** No other app or package may import `@repo/prisma` and query the database.
- **All business logic lives in `apps/api`** (there is no business logic in the BFF layers) — but _within_ `apps/api`, business logic lives in `services/`, not in route handlers. Route handlers narrow auth claims, call one service method, and translate the result (or thrown `Exception`) into an HTTP response. They do not call Prisma directly, run field validation, build transactions, or emit events themselves.
  - **This is a piloted convention, not yet applied everywhere.** `flags.ts` / `services/FlagService.ts` is the reference implementation. `environments.ts`, `apiKeys.ts`, `projects.ts`, and `members.ts` predate it and still inline logic in the route handler; extract them to `services/` opportunistically (e.g. when touching that route for another reason) rather than adding more inline logic to them.
  - **Services are plain classes with manual constructor DI** — not `Effect.Service`, not a DI framework. A service takes exactly one constructor parameter, an `Options` object (per `docs/standards/typescript.md`'s `LoggerOptions` pattern), holding its dependencies:

    ```ts
    export type FlagServiceOptions = {
      prisma: PrismaClient;
    };

    export class FlagService {
      constructor(private readonly options: FlagServiceOptions) {}
    }
    ```

  - **Dependencies are always injected, never imported as singletons inside the service** — this holds even though other, older code in this app imports the `@repo/prisma` singleton directly. A service takes `prisma` (or whatever it needs) through its `Options` object so tests can construct it with a fake.
  - **Service methods throw `Exception` subclasses directly**, same as route handlers do today — there is no Effect failure channel involved in the service layer. Effect is used in this app only for `Schema` validation (request bodies, env vars), not for service composition or control flow.
  - **Route handlers call the service inside a `try`/`catch`** (or let the thrown `Exception` propagate to the shared error-handling middleware, whichever is already wired) and call `.toResponse()` on it, exactly as they do today for exceptions thrown inline.

- **Every mutating request body is decoded through an Effect `Schema.Struct`** defined in `packages/api` (the sibling package) — see `CreateProjectRequestSchema`, `CreateEnvironmentRequestSchema`, `AddMemberRequestSchema` for the pattern (`Schema.decodeUnknownEither`, branch on `Either.isLeft`). Never define inline types for request bodies. **Paginated list GET responses are encoded through their `PaginatedResponseSchema`** (see `packages/api/src/schemas/pagination.ts`) via `Schema.encodeSync` before `c.json(...)` — see `users.ts`, `apiKeys.ts`, `environments.ts`, `members.ts`, and the list/audit-log handlers in `flags.ts` for the pattern. Single-resource GET responses (flag detail, project detail, etc.) still return plain typed Prisma projections until they adopt a schema too — match whichever style the endpoint you're touching already uses.
- **Every error is an `Exception` subclass** from `src/exceptions/`. Never call `c.json()` directly with a status code. Use `exception.toResponse()` or `throw exception` outside a service; inside a service, fail the `Effect` with it instead.

## Adding a New Route

1. Define the request/response schemas in `packages/api/src/` and re-export from its barrel.
2. Add or extend the resource's service class in `src/services/` with the operation's logic (validation, Prisma access, transactions, audit events, SSE emission).
3. Add the Hono route handler in `src/routes/`: narrow auth claims, decode the request body via Effect Schema, call the service method, and return its result (or `.toResponse()` on a thrown `Exception`).
4. Add any new error cases as `Exception` subclasses in `src/exceptions/`.

## Adding a New Service

Create `src/services/<Resource>Service.ts` as a plain class taking one `Options` constructor parameter:

```ts
import type { PrismaClient } from '@repo/prisma';

import { FlagNotFound, InvalidRollout } from '../exceptions/index.js';

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

Construct the service once per request (or at module scope with the real `prisma` singleton, mirroring how `prisma` itself is already a module-level instance) — e.g. `const flagService = new FlagService({ prisma });` — and call its methods from the route handler. Unit tests construct their own instance with a fake `prisma`.

## Adding a New Exception

Create a new file in `src/exceptions/` and export it from `src/exceptions/index.ts`:

```ts
import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class FlagNotFound extends HttpException {
  static readonly status = HttpStatusCode.NOT_FOUND_404;
  static readonly code = 'FlagNotFound';
  static readonly message = 'Flag not found.';
}
```

Extend `HttpException` (not the plain `Exception` base) — it adds `.toResponse()`, which every route handler in this app returns directly.

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
