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

## Rules

- **No session cookies or API keys.** This service only understands RS256 JWTs issued by either BFF layer. JWT verification is wired via `src/auth/middleware.ts`.
- **All Prisma access lives here.** No other app or package may import `@repo/prisma` and query the database.
- **All business logic lives here.** Route handlers perform validation, execute Prisma queries, and return structured responses. There is no business logic in the BFF layers.
- **Every request body and response shape is an Effect `Schema.Struct`** defined in `packages/api` (the sibling package). Import schemas from there; never define inline types for HTTP contracts.
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
import { Exception } from '@repo/exception';

export class FlagNotFound extends Exception {
  static readonly status = HttpStatusCode.NOT_FOUND_404;
  static readonly code = 'FlagNotFound';
  static readonly message = 'Flag not found.';
}
```

## Environment Variables

Validated at startup in `src/env.ts` via Effect `Schema.Struct`. Add new vars to both `src/env.ts` and the app's `.env.*` files.

## Commands

```bash
pnpm dev          # start in watch mode (from repo root)
pnpm build        # build to dist/
pnpm lint
pnpm check-types
```
