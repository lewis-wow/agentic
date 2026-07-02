# AGENTS.md — apps/api

## Role

`apps/api` is the **single source of truth** for all data in the monorepo. It is the only service that reads or writes the database. Every other layer (dashboard, bff, SDK clients) must go through this service.

## Required Context Loading

Before writing, refactoring, or reviewing any code here, read:

- @.docs/typescript.md
- @.docs/hono.md
- @.docs/effect.md
- @.docs/prisma.md

## Source Layout

```text
src/
  auth/middleware.ts   # JWT verification middleware — applied to all routes
  exceptions/          # App-specific Exception subclasses
  routes/              # Hono route handlers
  events/              # Internal event emitter
  env.ts               # Effect Schema env validation (validated at startup)
  index.ts             # Hono app entry point
```

Routes: `flags.ts` (mounted at `/projects/:projectId/flags`), `projects.ts` (mounted at `/projects` — list/create are non-project-scoped, detail/delete are project-scoped), `environments.ts` (mounted at `/projects/:projectId/environments`), `members.ts` (mounted at `/projects/:projectId/members`), `users.ts` (mounted at `/users`, owner-only), `sdk.ts` (mounted at `/v1`, for SDK clients).

Non-project-scoped routes (`/projects` list+create, `/users`) receive a `MeJwtClaims` token (`{ userId, systemRole }`, no `projectId`) rather than `ProjectJwtClaims` — narrow with `isSdkClaims` and a `'projectId' in auth` check the same way `flags.ts` does, not by assuming every claims object has a `projectId`.

## Rules

- **No session cookies or API keys.** This service only understands RS256 JWTs issued by either BFF layer. JWT verification is wired via `src/auth/middleware.ts`.
- **All Prisma access lives here.** No other app or package may import `@repo/prisma` and query the database.
- **All business logic lives here.** Route handlers perform validation, execute Prisma queries, and return structured responses. There is no business logic in the BFF layers.
- **Every mutating request body is decoded through an Effect `Schema.Struct`** defined in `packages/api` (the sibling package) — see `CreateProjectRequestSchema`, `CreateEnvironmentRequestSchema`, `AddMemberRequestSchema` for the pattern (`Schema.decodeUnknownEither`, branch on `Either.isLeft`). Never define inline types for request bodies. GET responses are currently returned as plain typed Prisma projections rather than encoded through a schema (existing convention in `flags.ts`); match that for new GET routes rather than introducing a second style.
- **Every error is an `Exception` subclass** from `src/exceptions/`. Never call `c.json()` directly with a status code. Use `exception.toResponse()` or `throw exception`.

## Adding a New Route

1. Define the request/response schemas in `packages/api/src/` and re-export from its barrel.
2. Add the Hono route handler in `src/routes/`.
3. Validate the incoming body via Effect Schema at the top of the handler.
4. Return responses through the schema encoder.
5. Add any new error cases as `Exception` subclasses in `src/exceptions/`.

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

## Environment Variables

Validated at startup in `src/env.ts` via Effect `Schema.Struct`. Add new vars to both `src/env.ts` and the app's `.env.*` files.

## Commands

```bash
pnpm dev          # start in watch mode (from repo root)
pnpm build        # build to dist/
pnpm lint
pnpm check-types
```
