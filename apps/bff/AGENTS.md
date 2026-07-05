# AGENTS.md — apps/bff

## Role

`apps/bff` is the **external BFF (Backend For Frontend) for SDK clients**. It validates SDK API keys, mints short-lived RS256 JWTs, and reverse-proxies all requests to `apps/api`. It contains no business logic.

## Required Context Loading

Before writing, refactoring, or reviewing any code here, read:

- @docs/standards/typescript.md
- @docs/standards/hono.md
- @docs/standards/effect.md

## Rules

- **No business logic.** The only work done here is authentication (parse Bearer token, verify API key, mint JWT) and proxying the request to `apps/api` via `@repo/bff`'s `forwardWithJwt`.
- **Bearer token format:** `<envSlug>_<apiKeyId>.<secret>` — the `envSlug` prefix is a cosmetic, unvalidated hint derived from the owning environment's name (see `docs/adr/0008-api-key-prefix-is-cosmetic-only.md`); only the trailing `<apiKeyId>.<secret>` is parsed. Parsing and verification use `@repo/bff` primitives.
- **No Prisma access.** Never import `@repo/prisma` here.
- **Every error is an `Exception` subclass.** Never call `c.json()` directly with a status code. Exceptions live in `src/exceptions/` if any are needed.
- **Environment variables** are validated at startup in `src/env.ts` via Effect `Schema.Struct`.
- **Build output** goes to `dist/`. Runs via `tsx` in development.

## Commands

```bash
pnpm dev          # start in watch mode (from repo root)
pnpm build        # build to dist/
pnpm lint
pnpm check-types
```
