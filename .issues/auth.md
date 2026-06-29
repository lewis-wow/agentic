# Auth Issues

All issues stem from the following grilling session decisions. Read this preamble before implementing any slice.

## Shared Design Decisions

### Role model

- `User.role` is a **system-level** field with values `OWNER | MEMBER`. There is exactly one `OWNER` per installation, created during the setup wizard. All other users are `MEMBER`.
- Project-level access (`admin | viewer`) is tracked in a `ProjectMember` join table — NOT on `User`.
- The `OWNER` **bypasses** all `ProjectMember` lookups. They have implicit full access to every project.

### JWT contract (BFF → `apps/api`)

- JWTs are **project-scoped**, RS256-signed, minted per-request by the BFF.
- **Owner path:** `{ userId, systemRole: 'OWNER', projectId, projectRole: 'owner' }`
- **Member path:** `{ userId, systemRole: 'MEMBER', projectId, projectRole: 'admin' | 'viewer' }`
- **SDK path (environment API key):** `{ projectId, environmentId, projectRole: 'sdk-client' }` — no `userId`
- BFF holds `AUTH_PRIVATE_KEY` (base64 PEM RS256 private key); `apps/api` holds `AUTH_PUBLIC_KEY` (base64 PEM RS256 public key).
- `apps/api` trusts JWT claims entirely — zero auth DB dependency.

### BFF session validation

- BFF validates sessions by reading `@repo/prisma` directly (no HTTP call to the dashboard, no `better-auth` in BFF).
- Looks up `Session` table by token, checks `expiresAt`, fetches `User`.
- Route shape: `app.use('/projects/:projectId/*', authMiddleware)` — project ID comes from the URL path.
- Non-project-scoped endpoints (e.g. `/me`) get a JWT with just `{ userId, systemRole }`.

### Dashboard auth

- `better-auth` (already in `apps/dashboard/package.json`) uses the Prisma adapter pointing at `@repo/prisma`.
- **Middleware:** cookie-presence check only (Edge-compatible). Real session validation happens in the root layout via `getSession()`.
- **First-boot detection:** `User.count() === 0` in middleware → redirect to `/setup`. Once a user exists, `/setup` redirects away.

### Setup wizard

- Creates: one `User` (role `OWNER`) + one `Project` + two `Environment` records (`development`, `production` with generated `apiKey`s).
- Self-registration is open (no invite flow). Non-owner users register normally; they see nothing until an owner/admin grants them a `ProjectMember` row.

### Environment API keys

- `Environment.apiKey` (already in schema) is the only API key type in scope. No personal access tokens (PATs) in this work.

---

## Issue 1 — Auth schema migration

### What to build

Extend the Prisma schema in `packages/prisma` to support the auth role model. No application logic — schema and migration only.

Changes:

- Fix `User.role` to use `OWNER` as the system-level owner value. The default should be `'MEMBER'`. Values are `'OWNER' | 'MEMBER'` (store as plain strings, not a Prisma enum, so `better-auth` can manage the field freely).
- Add `ProjectMember` model:
  - `id String @id @default(cuid())`
  - `userId String` + relation to `User`
  - `projectId String` + relation to `Project` (cascade delete)
  - `role String` — values `'admin' | 'viewer'` enforced in application code
  - `@@unique([userId, projectId])`
  - `createdAt / updatedAt`
- Add `members ProjectMember[]` to `Project`.
- Add `projectMembers ProjectMember[]` to `User`.
- Generate and apply a new Prisma migration.

### Acceptance criteria

- [ ] `ProjectMember` model exists in schema with `@@unique([userId, projectId])` and cascade delete on project removal
- [ ] `User.role` default is `'MEMBER'`; field accepts `'OWNER'` and `'MEMBER'`
- [ ] Migration file generated and applies cleanly against a fresh database
- [ ] `pnpm check-types` passes across all packages
- [ ] `pnpm lint` passes

### Blocked by

None — can start immediately.

---

## Issue 2 — `better-auth` wiring + login/logout

### What to build

Wire `better-auth` into `apps/dashboard` with email/password authentication backed by the shared Prisma DB. Deliver a working `/login` page and logout action. No route protection yet (that is Issue 4).

`better-auth` is already present in `apps/dashboard/package.json`. Configure it with:

- The **Prisma adapter** pointing at `@repo/prisma`'s client
- Email/password provider only — no OAuth, no magic links
- Session stored in the `Session` table (already in schema)

Deliverables:

- `better-auth` server instance (e.g. `src/lib/auth.ts`) — this is the single source of truth for session management
- `better-auth` API route handler at `app/api/auth/[...all]/route.ts`
- `/login` page: email + password form, server action that calls `better-auth`'s sign-in, redirects to `/dashboard` on success, shows error on failure
- Logout server action: calls `better-auth`'s sign-out, clears session cookie, redirects to `/login`
- `BETTER_AUTH_SECRET` and `DATABASE_URL` added to `apps/dashboard/.env.development`

No registration UI is needed on the login page — the setup wizard (Issue 3) handles the first user. Subsequent users self-register; build a `/register` page with name/email/password that calls `better-auth`'s sign-up.

### Acceptance criteria

- [ ] Visiting `/login` shows an email/password form
- [ ] Valid credentials set a session cookie and redirect to `/dashboard`
- [ ] Invalid credentials show an error message without crashing
- [ ] Logout clears the session cookie and redirects to `/login`
- [ ] `/register` page allows new users to create an account (they will have no project access until granted by an owner/admin — that is Issue 4)
- [ ] `pnpm check-types`, `pnpm lint` pass

### Blocked by

- Issue 1 (schema must have `User`, `Session`, `Account`, `Verification` tables)

---

## Issue 3 — First-boot setup wizard

### What to build

Deliver the first-boot experience: detect an empty database and route to a setup wizard that creates the owner account, first project, and default environments.

**First-boot detection (in `middleware.ts`):**

- On every request, check `User.count()` via `@repo/prisma` — if `0`, redirect to `/setup`
- If a user exists and the request is for `/setup`, redirect to `/dashboard`
- This check must run in Node.js middleware (not Edge), because it uses Prisma. Configure `middleware.ts` with `export const config = { runtime: 'nodejs' }` (or use a route-level approach if Next.js 15 requires it)

**Wizard UI at `/setup`:**

- Single form collecting: owner full name, email, password, and project name
- On submit, a server action:
  1. Re-checks `User.count() === 0` (guard against race conditions)
  2. Creates `User` via `better-auth`'s sign-up, then sets `user.role = 'OWNER'`
  3. Creates `Project` with the given name
  4. Creates two `Environment` records: `{ name: 'development' }` and `{ name: 'production' }` — `apiKey` is auto-generated by the `@default(cuid())` on the field
  5. Signs the owner in (session cookie)
  6. Redirects to `/dashboard`

If `User.count() > 0` when the action runs, return a validation error — do not create a second owner.

### Acceptance criteria

- [ ] Fresh database: any route redirects to `/setup`
- [ ] `/setup` form with name, email, password, project name fields
- [ ] Submitting the form creates exactly one `User` (role `OWNER`), one `Project`, and two `Environment` records (`development`, `production`)
- [ ] After wizard completes, user is signed in and redirected to `/dashboard`
- [ ] Revisiting `/setup` after completion redirects to `/dashboard`
- [ ] Submitting the wizard twice returns an error, no duplicate records
- [ ] `pnpm check-types`, `pnpm lint` pass

### Blocked by

- Issue 2 (`better-auth` must be configured before sign-up/sign-in calls work)

---

## Issue 4 — Dashboard route protection + project membership

### What to build

Protect all dashboard routes and deliver the UI for granting project access to registered users.

**Middleware (`middleware.ts`) — extend Issue 3's middleware:**

- If no `better-auth` session cookie is present on a protected route → redirect to `/login`
- Public routes (no auth required): `/login`, `/register`, `/setup`, `/api/auth/*`

**Root layout guard:**

- In the dashboard root layout (server component), call `better-auth`'s `getSession()` to validate the session against the DB
- If session is missing or expired → redirect to `/login`
- Attach the session user to the render context (e.g. via a server-side context helper)

**Role-gating:**

- Owner (`user.role === 'OWNER'`): full access to all routes
- Non-owners on owner-only pages (e.g. system settings, user management): 403 or redirect
- Project-level route guard (e.g. `/projects/[projectId]`): check `ProjectMember` for the current user + project. No membership → 403.

**Project membership UI:**

- Owner and project admins can open a "Members" panel on a project
- Shows list of current `ProjectMember` rows with their role
- Search/select from existing `User` records (users who have self-registered) to add as `admin` or `viewer`
- Remove member action (deletes `ProjectMember` row)
- Owner is always shown as implicit member (no `ProjectMember` row required)

### Acceptance criteria

- [ ] Unauthenticated request to any `/dashboard` route redirects to `/login`
- [ ] Expired/invalid session cookie is caught by layout guard and redirects to `/login`
- [ ] Owner can access all routes
- [ ] Non-owner accessing an owner-only route receives 403
- [ ] Non-owner with no `ProjectMember` row for a project receives 403 on that project's routes
- [ ] Non-owner with `ProjectMember` (admin or viewer) can access the project
- [ ] Owner can add a registered user to a project with a chosen role
- [ ] Owner/admin can remove a member from a project
- [ ] `pnpm check-types`, `pnpm lint` pass

### Blocked by

- Issue 2 (`better-auth` session required)
- Issue 3 (setup wizard must exist so there is always an owner)

---

## Issue 5 — BFF session → project-scoped RS256 JWT (+ API verification)

### What to build

Implement the auth middleware in `apps/bff` that translates a validated session cookie into a short-lived RS256 project-scoped JWT, and implement the corresponding JWT verification middleware in `apps/api`. This is the trust bridge between the frontend and backend microservice.

**BFF middleware (Hono, `apps/bff`):**

Apply to: `app.use('/projects/:projectId/*', authMiddleware)`

Steps:

1. Extract session token from the `Cookie` header (same cookie name `better-auth` sets)
2. Look up `Session` via `@repo/prisma`: find by token, check `expiresAt > now()`. If missing or expired → 401.
3. Fetch `User` from the session. If not found → 401.
4. Extract `:projectId` from the URL path.
5. **Owner path:** if `user.role === 'OWNER'`, mint JWT with `{ userId, systemRole: 'OWNER', projectId, projectRole: 'owner' }`.
6. **Member path:** look up `ProjectMember` where `userId = user.id AND projectId = :projectId`. If not found → 403. Mint JWT with `{ userId, systemRole: 'MEMBER', projectId, projectRole: <member.role> }`.
7. Sign the JWT with RS256 using `AUTH_PRIVATE_KEY` (base64-encoded PEM, loaded from env).
8. Forward the request to `apps/api` with the JWT in the `Authorization: Bearer <token>` header.

JWT should have a short `exp` (e.g. 60 seconds — it covers a single proxied request).

**Non-project routes (e.g. `/me`):** separate middleware that mints `{ userId, systemRole }` only, no project lookup.

**`apps/api` JWT middleware (Hono):**

- Verify the RS256 JWT using `AUTH_PUBLIC_KEY` (base64-encoded PEM from env)
- Invalid/expired JWT → 401
- Inject verified claims into Hono context (`c.set('auth', claims)`) for downstream route handlers
- Add `AUTH_PUBLIC_KEY` to `apps/api` env schema

**Environment variables:**

- `apps/bff`: `AUTH_PRIVATE_KEY` (base64 PEM RS256 private key)
- `apps/api`: `AUTH_PUBLIC_KEY` (base64 PEM RS256 public key)
- Add both to their respective `env.ts` schemas using `createEnv` from `@repo/utils`

**Tests (`apps/bff/__tests__/integration/`):**

- Valid session + owner → JWT with `projectRole: 'owner'`, no `ProjectMember` lookup needed
- Valid session + member with `admin` role → JWT with `projectRole: 'admin'`
- Valid session + no `ProjectMember` row → 403
- Missing session cookie → 401
- Expired session → 401
- JWT verify unit test: valid claims round-trip, expired token rejected, tampered signature rejected

### Acceptance criteria

- [ ] Owner session cookie → JWT with `{ userId, systemRole: 'OWNER', projectId, projectRole: 'owner' }`
- [ ] Member session cookie + `ProjectMember(admin)` → JWT with `projectRole: 'admin'`
- [ ] Member session cookie + no membership → 403
- [ ] Missing or expired session cookie → 401
- [ ] `apps/api` rejects requests with missing/invalid/expired JWT with 401
- [ ] `apps/api` injects verified claims into Hono context
- [ ] `AUTH_PRIVATE_KEY` in BFF env schema; `AUTH_PUBLIC_KEY` in API env schema
- [ ] Integration tests pass (`pnpm test:integration`)
- [ ] `pnpm check-types`, `pnpm lint` pass

### Blocked by

- Issue 1 (schema needed for `Session`, `User`, `ProjectMember` DB reads)

---

## Issue 6 — BFF environment API key → SDK-scoped JWT

### What to build

Extend the BFF to accept `Environment.apiKey` values (used by SDK clients for flag evaluation) and translate them into an SDK-scoped JWT that `apps/api` can verify.

This is a separate auth path from the session path (Issue 5) but uses the same RS256 signing infrastructure.

**BFF middleware — SDK key path:**

- Accept the API key via `Authorization: Bearer <apiKey>` header (or `X-API-Key: <apiKey>` — pick one and document it)
- Look up `Environment` via `@repo/prisma` where `apiKey = <key>`
- If not found → 401
- Mint JWT: `{ projectId: env.projectId, environmentId: env.id, projectRole: 'sdk-client' }` — no `userId`
- Sign with the same RS256 `AUTH_PRIVATE_KEY`
- Forward to `apps/api`

**`apps/api` side:**

- Already verifies RS256 JWTs (from Issue 5). The `sdk-client` projectRole is a new value — downstream route handlers can check `c.get('auth').projectRole === 'sdk-client'` to gate SDK-only endpoints.

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

- Issue 5 (RS256 signing infrastructure and `apps/api` JWT verification must exist first)
