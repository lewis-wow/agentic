# Auth Issues

All issues stem from the following grilling session decisions. Read this preamble before implementing any slice.

> **2026-07-03 update:** Authentication was pivoted from `better-auth` (email + password) to **Trusted Proxy Authentication** — the operator deploys `apps/dashboard`/`apps/bff` behind a reverse proxy (oauth2-proxy, Authelia, Pomerium, or similar) that authenticates the user and asserts their identity via a header. This platform has no built-in login of its own. Issues 2, 3, 4, and 5 below are rewritten to match; Issue 1 (minus the now-removed `Account`/`Session`/`Verification` models) and Issue 6 (SDK API keys) are unaffected. See `.plans/PRD.md` Section 8.1 for the product-level description.

## Shared Design Decisions

### Role model

- `User.role` is a **system-level** field with values `OWNER | MEMBER`. There is exactly one `OWNER` per installation, assigned to the email named by `TRUSTED_PROXY_OWNER_EMAIL` the first time it's seen. All other users are `MEMBER`.
- Project-level access (`admin | viewer`) is tracked in a `ProjectMember` join table — NOT on `User`.
- The `OWNER` **bypasses** all `ProjectMember` lookups. They have implicit full access to every project.

### JWT contract (BFF → `apps/api`)

- JWTs are **project-scoped**, RS256-signed, minted per-request by `apps/bff`.
- **Owner path:** `{ userId, systemRole: 'OWNER', projectId, projectRole: 'owner' }`
- **Member path:** `{ userId, systemRole: 'MEMBER', projectId, projectRole: 'admin' | 'viewer' }`
- **SDK path (environment API key):** `{ projectId, environmentId, projectRole: 'sdk-client' }` — no `userId`
- `apps/bff` holds `AUTH_PRIVATE_KEY` (base64 PEM RS256 private key); `apps/api` holds `AUTH_PUBLIC_KEY` (base64 PEM RS256 public key).
- `apps/api` trusts JWT claims entirely — zero auth DB dependency.

### Trusted Proxy Authentication

- Authentication is delegated entirely to an operator-supplied reverse proxy in front of the stack. This app never validates a password, session cookie, or OAuth token itself.
- The proxy asserts identity via an **Identity Header** carrying the user's email. Its _name_ is operator-configured (`TRUSTED_PROXY_IDENTITY_HEADER`, default `X-Forwarded-Email`), since oauth2-proxy, Authelia, and Pomerium each default to a different header name. Only email is read — no display name, no group claim.
- A **Trusted Proxy Secret** (fixed header name `X-Trusted-Proxy-Secret`, value from `TRUSTED_PROXY_SECRET`) must also be present and match, compared with a timing-safe check. This is defense-in-depth against a client reaching the app directly and forging the Identity Header — it does not replace network isolation, which the operator is still responsible for.
- Scoped to plain-header proxies (oauth2-proxy, Authelia, Pomerium). Signature-verifying proxies (Cloudflare Access, GCP IAP, AWS ALB) are out of scope for v1 — see `.plans/PRD.md` Section 15.
- On a valid secret + email: upsert `User` by email. The `update` clause is **empty** — an existing user's role is never overwritten by a repeat request. On insert, `role` is `OWNER` if the email matches `TRUSTED_PROXY_OWNER_EMAIL`, otherwise `MEMBER`.
- `apps/bff` is the component that performs this validation and mints the JWT — see Issue 2. `apps/dashboard`'s catch-all route no longer does its own credential exchange; it forwards the original request (headers intact) to `apps/bff` — see Issue 5.
- `apps/dashboard`'s server-rendered pages (`guards.ts`) independently perform the same header resolution locally for page-level redirect/forbidden decisions — see Issue 4. This is a UX-level gate; the actual security boundary is `apps/api` only ever trusting JWTs minted by `apps/bff`.
- Health checks: both `apps/dashboard` and `apps/bff` expose a narrow, unauthenticated liveness route (no flag/user data) that bypasses the trusted-proxy check, since orchestrators typically probe the container directly rather than through the external reverse proxy.
- Local dev: `pnpm dev` runs alongside a small header-injecting proxy script so developers get a working identity without deploying a real oauth2-proxy/Authelia/Pomerium locally. This lives entirely in dev tooling — the app's own code path always requires real headers, in dev and production alike.

### Setup wizard

- Creates: first `Project` + two `Environment` records (`development`, `production` with generated `apiKey`s), once the designated owner email has been seen at least once (which JIT-provisions their `User` row as `OWNER`).
- No credentials are collected — identity is already resolved via the trusted proxy. The only input is the first project's name.

### Environment API keys

- `Environment.apiKey` (already in schema) is the only API key type in scope. No personal access tokens (PATs) in this work.

---

## Issue 1 — Auth schema migration

### What to build

Extend the Prisma schema in `packages/prisma` to support the auth role model, and remove the models that only existed for `better-auth`. Schema and migration only — no application logic.

Changes:

- Fix `User.role` to use `OWNER` as the system-level owner value. The default should be `'MEMBER'`. Values are `'OWNER' | 'MEMBER'` (store as plain strings, not a Prisma enum).
- Add `ProjectMember` model:
  - `id String @id @default(cuid())`
  - `userId String` + relation to `User`
  - `projectId String` + relation to `Project` (cascade delete)
  - `role String` — values `'admin' | 'viewer'` enforced in application code
  - `@@unique([userId, projectId])`
  - `createdAt / updatedAt`
- Add `members ProjectMember[]` to `Project`.
- Add `projectMembers ProjectMember[]` to `User`.
- **Remove** the `Account`, `Session`, and `Verification` models entirely, and their relations on `User` — nothing reads them once `better-auth` is gone.
- Generate and apply a new Prisma migration.

### Acceptance criteria

- [ ] `ProjectMember` model exists in schema with `@@unique([userId, projectId])` and cascade delete on project removal
- [ ] `User.role` default is `'MEMBER'`; field accepts `'OWNER'` and `'MEMBER'`
- [ ] `Account`, `Session`, `Verification` models and their `User` relations are removed
- [ ] Migration file generated and applies cleanly against a fresh database
- [ ] `pnpm check-types` passes across all packages
- [ ] `pnpm lint` passes

### Blocked by

None — can start immediately.

---

## Issue 2 — `apps/bff` Trusted Proxy Authentication → project-scoped RS256 JWT

### What to build

Replace `apps/bff`'s session-cookie-based `createProjectAuthMiddleware`/`createMeAuthMiddleware` with Trusted-Proxy-header-based equivalents. This is the trust bridge between the operator's reverse proxy and `apps/api`.

**`packages/bff`** — add a pure primitive:

```ts
export type ResolveTrustedProxyUserArgs = {
  secret: string | undefined;
  email: string | undefined;
  expectedSecret: string;
  designatedOwnerEmail: string;
  upsertUser: (args: { email: string; role: SystemRole }) => Promise<User>;
};

export const resolveTrustedProxyUser = async (
  args: ResolveTrustedProxyUserArgs,
): Promise<User | null> => { ... };
```

- Timing-safe secret comparison (`node:crypto`'s `timingSafeEqual`), not `===`.
- Returns `null` (without calling `upsertUser`) when the secret is missing/mismatched, or when `email` is missing.
- Calls `upsertUser` with `role: OWNER` when `email === designatedOwnerEmail`, else `role: MEMBER`.

**`apps/bff/src/auth/middleware.ts`** — new middlewares, same route shape as today:

- `createTrustedProxyProjectAuthMiddleware` — reads the Identity Header + Trusted Proxy Secret header, calls `resolveTrustedProxyUser` (with `upsertUser` implemented via `prisma.user.upsert({ where: { email }, create: { email, name: email, role }, update: {} })`), then resolves project role exactly as today: `OWNER` bypasses `ProjectMember`; otherwise look up `ProjectMember` for `:projectId` (404/403 on no membership). Mints `ProjectJwtClaims`.
- `createTrustedProxyMeAuthMiddleware` — same identity resolution, mints `MeJwtClaims` only (no project lookup).
- Missing/invalid secret or missing email → 401, and `upsertUser`/Prisma are never touched.

**`apps/bff/src/env.ts`** — add:

- `TRUSTED_PROXY_SECRET: Schema.String`
- `TRUSTED_PROXY_IDENTITY_HEADER: Schema.optionalWith(Schema.String, { default: () => 'X-Forwarded-Email' })`
- `TRUSTED_PROXY_OWNER_EMAIL: Schema.String`

**`apps/bff/src/index.ts`** — wire the new middlewares onto the same routes (`/projects/:projectId/*`, `/me`); everything else (SDK `/v1/*` auth) is untouched.

### Acceptance criteria

- [ ] Valid secret + Identity Header for an unseen email matching `TRUSTED_PROXY_OWNER_EMAIL` → JWT with `{ systemRole: 'OWNER', projectRole: 'owner' }`, no `ProjectMember` lookup
- [ ] Valid secret + Identity Header for a `MEMBER` with `ProjectMember(admin)` → JWT with `projectRole: 'admin'`
- [ ] Valid secret + Identity Header, no `ProjectMember` row → 403
- [ ] Missing or mismatched secret → 401, `upsertUser`/Prisma never called
- [ ] Missing Identity Header → 401
- [ ] A second request for an already-existing user never changes their stored role, even if their email matches `TRUSTED_PROXY_OWNER_EMAIL` and their current role is `MEMBER`
- [ ] `pnpm check-types`, `pnpm lint` pass
- [ ] Unit tests for `resolveTrustedProxyUser`; integration tests for the `apps/bff` middleware behaviors above

### Blocked by

- Issue 1 (schema must have `User`, `ProjectMember`)

---

## Issue 3 — First-boot setup

### What to build

Replace the password-based setup wizard with a project-only bootstrap, since owner identity is already resolved via the trusted proxy the moment they're seen.

- Delete the Edge `middleware.ts` cookie-presence check entirely — there's no cookie to check for, and every route needs the same (Node-runtime, DB-backed) trusted-proxy resolution that only `guards.ts` can do. Public/private path branching no longer applies.
- `/setup` page: a single field, project name. Guarded so it's only reachable by the resolved user whose email matches `TRUSTED_PROXY_OWNER_EMAIL` **and** `Project.count() === 0`. Anyone else hitting `/setup` on a fresh install sees a "waiting for the owner to finish setup" state, not the form.
- Submitting the form creates one `Project` and two `Environment` records (`development`, `production`; `apiKey` auto-generated by `@default(cuid())`).
- Revisiting `/setup` after a project already exists redirects to `/dashboard`.

### Acceptance criteria

- [ ] Fresh database, owner email visits any route → redirected to `/setup`
- [ ] Fresh database, non-owner email visits `/setup` → sees a waiting state, not the form
- [ ] Submitting `/setup` creates exactly one `Project` and two `Environment` records
- [ ] Revisiting `/setup` after completion redirects to `/dashboard`
- [ ] Submitting the wizard twice returns an error, no duplicate records
- [ ] `pnpm check-types`, `pnpm lint` pass

### Blocked by

- Issue 2 (trusted-proxy user resolution must exist for `guards.ts` to use)

---

## Issue 4 — Dashboard route protection + project membership

### What to build

Protect all dashboard routes using the trusted-proxy identity instead of a Better Auth session, and deliver the UI for granting project access.

**`guards.ts`:**

- `requireSession()` (kept as the name other guards call) resolves identity by reading the Identity Header + Trusted Proxy Secret header via `headers()` (`next/headers`) and calling `@repo/bff`'s `resolveTrustedProxyUser`, with `upsertUser` backed by `prisma.user.upsert` (same empty-update-clause pattern as Issue 2's `apps/bff` implementation — duplicated here deliberately, since `apps/dashboard` needs this for server-rendered page gating independent of the `apps/bff` data-path proxy).
- On resolution failure → call Next.js's `unauthorized()` (not `redirect('/login')` — there is no login page). Add the matching `app/unauthorized.tsx` boundary.
- `requireOwner()` / `requireProjectAccess()` are structurally unchanged — same role-gating logic, just fed by the new identity resolution.

**Members UI:** unchanged from the original design — owner/admin can list, add (search existing `User`s), and remove `ProjectMember` rows.

### Acceptance criteria

- [ ] Request with missing/invalid trusted-proxy headers hitting a guarded page → Next.js `unauthorized()` boundary, not a redirect loop
- [ ] Owner can access all routes
- [ ] Non-owner accessing an owner-only route receives 403 (`forbidden()`)
- [ ] Non-owner with no `ProjectMember` row for a project receives 403 on that project's routes
- [ ] Non-owner with `ProjectMember` (admin or viewer) can access the project
- [ ] Owner can add a registered user to a project with a chosen role; owner/admin can remove a member
- [ ] `pnpm check-types`, `pnpm lint` pass

### Blocked by

- Issue 2 (trusted-proxy resolution primitive)
- Issue 3 (setup must exist so there is always an owner)

---

## Issue 5 — Dashboard catch-all route forwards to `apps/bff`

### What to build

`apps/dashboard`'s catch-all route (`app/api/[...path]/route.ts`) stops doing its own credential exchange. It becomes a pure forward of the original request — method, path, query string, body, and **all original headers** (including whatever the reverse proxy set) — to `apps/bff`, which performs the actual Trusted Proxy Authentication (Issue 2) and forwards on to `apps/api`.

- New env var: `apps/dashboard`'s `BFF_URL` (default `http://localhost:3002`), replacing the route's direct calls into `@repo/bff`'s (now-removed) session/JWT helpers.
- Update `apps/dashboard/AGENTS.md`'s description of the catch-all route: it forwards to `apps/bff`, not directly to `apps/api`; it does no authentication of its own.

### Acceptance criteria

- [ ] A proxied request from the dashboard, made with valid trusted-proxy headers on the original browser request, reaches `apps/api` with correct claims end-to-end
- [ ] Query string and request body are preserved through the forward
- [ ] `pnpm check-types`, `pnpm lint` pass

### Blocked by

- Issue 2 (`apps/bff` must be able to receive and authenticate these forwarded requests)

---

## Issue 6 — BFF environment API key → SDK-scoped JWT

### What to build

Extend the BFF to accept `Environment.apiKey` values (used by SDK clients for flag evaluation) and translate them into an SDK-scoped JWT that `apps/api` can verify.

This is a separate auth path from the Trusted Proxy path (Issues 2–5) but uses the same RS256 signing infrastructure. Unaffected by the Trusted Proxy Authentication pivot.

**BFF middleware — SDK key path:**

- Accept the API key via `Authorization: Bearer <apiKey>` header
- Look up `Environment` via `@repo/prisma` where `apiKey = <key>`
- If not found → 401
- Mint JWT: `{ projectId: env.projectId, environmentId: env.id, projectRole: 'sdk-client' }` — no `userId`
- Sign with the same RS256 `AUTH_PRIVATE_KEY`
- Forward to `apps/api`

**`apps/api` side:**

- Already verifies RS256 JWTs (from Issue 2). The `sdk-client` projectRole is a distinct value — downstream route handlers can check `c.get('auth').projectRole === 'sdk-client'` to gate SDK-only endpoints.

**Route scope:**

- SDK key auth applies to SDK-facing routes (e.g. flag evaluation endpoints), not dashboard-proxy routes. Apply as a separate middleware on those routes.

**Tests (`apps/bff/__tests__/integration/`):**

- Valid `Environment.apiKey` → JWT with `{ projectId, environmentId, projectRole: 'sdk-client' }`
- Unknown API key → 401
- JWT reaches `apps/api` and passes verification

### Acceptance criteria

- [ ] Valid `Environment.apiKey` in `Authorization` header → JWT with `{ projectId, environmentId, projectRole: 'sdk-client' }`
- [ ] Unknown API key → 401
- [ ] `apps/api` accepts and verifies the SDK-scoped JWT
- [ ] SDK-only routes can distinguish `'sdk-client'` role from dashboard user roles
- [ ] Integration tests pass
- [ ] `pnpm check-types`, `pnpm lint` pass

### Blocked by

- Issue 2 (RS256 signing infrastructure and `apps/api` JWT verification must exist first)
