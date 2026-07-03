# AGENTS.md — packages/bff

## Purpose

Credential-exchange primitives shared by both BFF layers (`apps/bff` and `apps/dashboard`'s Next.js catch-all route). Provides Trusted Proxy Authentication validation and the `forwardWithJwt` / `forwardRequest` proxy helpers.

## Required Context Loading

- @.docs/typescript.md

## Exports

| Export                        | Description                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `resolveTrustedProxyUser`     | Validates the Trusted Proxy Secret + Identity Header (timing-safe), then upserts and returns the `User`, or `null` if invalid |
| `ResolveTrustedProxyUserArgs` | Argument type for `resolveTrustedProxyUser`                                                                                   |
| `forwardWithJwt`              | Injects `Authorization: Bearer <jwt>`, rewrites origin to `apiBaseUrl`, and reverse-proxies the request                       |
| `forwardRequest`              | Reverse-proxies the request unchanged (no Authorization injected) — used where the upstream does its own auth                 |

## Rules

- This package is **framework-agnostic** — it must work in both Hono middleware and Next.js Route Handlers. Never import Hono or Next.js types here.
- `resolveTrustedProxyUser` is the only place in the codebase that validates the Trusted Proxy Secret / Identity Header pair. It takes the extracted `secret`/`email` strings and an injected `upsertUser` callback — it never reads headers or touches Prisma itself. `apps/bff`'s middleware and `apps/dashboard`'s `guards.ts` each call it with their own Prisma-backed `upsertUser`, since one enforces the actual data-path JWT minting and the other gates server-rendered pages — but the validation logic itself lives only here.
- `forwardWithJwt` / `forwardRequest` are the only places that build the proxied request. Consuming apps call them; they do not hand-roll `fetch` to another service.
- Exports are maintained via a barrelsby barrel at `src/index.ts`. After adding a new export, run `pnpm barrels` from the repo root.
