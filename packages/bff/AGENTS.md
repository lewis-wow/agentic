# AGENTS.md — packages/bff

## Purpose

Credential-exchange primitives shared by both BFF layers (`apps/bff` and `apps/dashboard` Next.js API routes). Provides session validation, RS256 JWT minting, and the `forwardWithJwt` proxy helper.

## Required Context Loading

- @.docs/typescript.md

## Exports

| Export                | Description                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| `SESSION_COOKIE`      | Name of the Better Auth session cookie (`better-auth.session_token`)                                    |
| `SessionWithUser`     | Type: a `Session` row joined with its `User`                                                            |
| `extractSessionToken` | Strips the `.signature` suffix from the raw cookie value                                                |
| `resolveSessionUser`  | Validates the session token against the DB and returns the `User` or `null`                             |
| `forwardWithJwt`      | Injects `Authorization: Bearer <jwt>`, rewrites origin to `apiBaseUrl`, and reverse-proxies the request |

## Rules

- This package is **framework-agnostic** — it must work in both Hono middleware and Next.js Route Handlers. Never import Hono or Next.js types here.
- `resolveSessionUser` is the only place in the codebase that validates a session cookie. Do not duplicate this logic in consuming apps.
- `forwardWithJwt` is the only place that builds the proxied request. Consuming apps call it; they do not hand-roll `fetch` to `apps/api`.
- Exports are maintained via a barrelsby barrel at `src/index.ts`. After adding a new export, run `pnpm barrels` from the repo root.
