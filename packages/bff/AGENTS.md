# AGENTS.md — packages/bff

## Purpose

Credential-exchange primitives shared by both BFF layers (`apps/bff` and `apps/dashboard`'s Next.js catch-all route). Provides Trusted Proxy Authentication validation and the `forwardWithJwt` / `forwardRequest` proxy helpers.

## Required Context Loading

- @docs/standards/typescript.md

## Exports

| Export                              | Description                                                                                                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolveTrustedProxyUser`           | Verifies the Proxy Identity JWT (via an injected `verify`), resolves the identity email, then upserts and returns the `User`, or `null` if invalid |
| `ResolveTrustedProxyUserArgs`       | Argument type for `resolveTrustedProxyUser`                                                                                                        |
| `createTrustedProxyJwtVerifier`     | Builds a `TrustedProxyJwtVerifier` backed by a remote JWKS endpoint — construct once per process, inject into `resolveTrustedProxyUser`            |
| `TrustedProxyJwtVerifier`           | Verifier function type: `(jwt: string) => Promise<JWTPayload>`, throws on any verification failure                                                 |
| `CreateTrustedProxyJwtVerifierArgs` | Argument type for `createTrustedProxyJwtVerifier`                                                                                                  |
| `resolveProjectRole`                | Resolves a user's `ProjectRole` for a project — `owner` for the system `OWNER`, `null` for everyone else                                           |
| `ResolveProjectRoleArgs`            | Argument type for `resolveProjectRole`                                                                                                             |
| `forwardWithJwt`                    | Injects `Authorization: Bearer <jwt>`, rewrites origin to `apiBaseUrl`, and reverse-proxies the request                                            |
| `forwardRequest`                    | Reverse-proxies the request unchanged (no Authorization injected) — used where the upstream does its own auth                                      |

## Rules

- This package is **framework-agnostic** — it must work in both Hono middleware and Next.js Route Handlers. Never import Hono or Next.js types here.
- `resolveTrustedProxyUser` is the only place in the codebase that resolves identity from a Proxy Identity JWT. It takes the extracted `jwt` string, an injected `verify` (`TrustedProxyJwtVerifier`), an `emailClaimPath`, and an injected `upsertUser` callback — it never reads headers, builds its own JWKS client, or touches Prisma itself. `apps/bff`'s middleware and `apps/dashboard`'s `guards.ts` each build their own `verify` via `createTrustedProxyJwtVerifier` (once per process, at startup) and call `resolveTrustedProxyUser` with their own Prisma-backed `upsertUser` — one enforces the actual data-path JWT minting, the other gates server-rendered pages — but the verification/resolution logic itself lives only here. See [ADR-0024](../../docs/adr/0024-jwt-verified-trusted-proxy-identity.md).
- Auth-failure exceptions (`Unauthorized`, `Forbidden`, `MissingProjectId`) live in `apps/bff/src/exceptions/`, not here — only `apps/bff`'s middleware ever constructs an HTTP response from a failure; `resolveTrustedProxyUser` fails closed by returning `null`, and `apps/dashboard`'s `guards.ts` translates that into Next.js's `unauthorized()`/`forbidden()` boundaries itself.
- `resolveProjectRole` is the only place that implements "system `OWNER` → `owner`; everyone else → `null`." Project access is owner-only — there is no per-project membership. Callers translate a `null` result into their own error convention (`apps/bff`'s middleware returns an HTTP 403; `apps/dashboard`'s `guards.ts` calls Next.js's `forbidden()`).
- `forwardWithJwt` / `forwardRequest` are the only places that build the proxied request. Consuming apps call them; they do not hand-roll `fetch` to another service.
- Exports are maintained via a barrelsby barrel at `src/index.ts`. After adding a new export, run `pnpm barrels` from the repo root.
