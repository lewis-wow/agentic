# Slice 4 — Boolean Flag CRUD + Audit Events

## Architecture decisions (agreed in design session)

- **`apps/api` is the single source of truth.** All Prisma queries and business logic live there. No direct Prisma calls from the dashboard.
- **No Next.js server actions for data.** All dashboard data goes through TanStack Query → Next.js API route handlers → `apps/api`.
- **Next.js API routes act as the internal BFF** for the dashboard UI: they read the Better Auth session cookie, exchange it for a short-lived RS256 JWT via `@repo/bff`, and forward the request to `apps/api`.
- **`packages/bff`** is a new shared package containing the credential-exchange primitives (`resolveSessionUser`, `forwardWithJwt`) used by both `apps/bff` (API key → JWT) and the Next.js API route handlers (session → JWT).
- **TanStack Query** (`useQuery` / `useMutation`) is the only data-fetching mechanism in the dashboard. Query key factories, fetchers, and mutation hooks are colocated in `apps/dashboard/src/queries/` per resource.
- **FlagState is eagerly initialized:** when a flag is created, a `FlagState` row is inserted for every existing environment in the project, all defaulting to `status: inactive`.
- **Archive is state-level:** archiving a flag sets all its `FlagState` rows to `status: archived`. No new column on `Flag`. Unarchiving restores all states to `inactive`.
- **`Flag.key` is immutable** after creation. Only `Flag.name` can be renamed.
- **Flag create form** has two fields: `name` (display label) and `key` (auto-populated from name as a slug, editable before submission, locked after creation).
- **Flags list** lives at `/projects/[projectId]/flags` (separate page, not a panel). It has an environment selector at the top; the list shows each flag's `FlagState.status` for the selected environment.
- **All flag mutations require `canManage`** (project role `owner` or `admin`). `viewer` can read only.
- **AuditEvent `action` values** are dot-namespaced strings. Valid values and `meta` shapes:

  | action            | meta                                                |
  | ----------------- | --------------------------------------------------- |
  | `flag.created`    | `{ key, name }`                                     |
  | `flag.renamed`    | `{ oldName, newName }`                              |
  | `flag.archived`   | `{}`                                                |
  | `flag.unarchived` | `{}`                                                |
  | `flag.deleted`    | `{ key, name }`                                     |
  | `flag.toggled`    | `{ environmentId, status: "active" \| "inactive" }` |

---

## Issue 1: `packages/bff` — shared BFF primitives + infrastructure

### What to build

Create `packages/bff` as a new shared internal package. Extract the session-validation and request-forwarding logic that currently lives inline in `apps/bff/src/auth/middleware.ts` into this package so both `apps/bff` and the Next.js API route handlers can share it.

**`packages/bff` exports:**

- `extractSessionToken(rawCookie: string): string` — strips the Better Auth `.signature` suffix before DB lookup
- `resolveSessionUser(rawCookie: string | undefined, findSession: SessionLookup): Promise<User | null>` — validates the token against the DB and checks expiry
- `forwardWithJwt(request: Request, jwt: string, apiBaseUrl: string): Promise<Response>` — injects `Authorization: Bearer <jwt>`, rewrites the URL to `apiBaseUrl`, and returns the proxied `Response`

**`apps/bff` refactor:** update `apps/bff/src/auth/middleware.ts` to import from `@repo/bff` instead of implementing these inline. Behaviour must be identical — no logic changes, only extraction.

**Next.js API route scaffold in `apps/dashboard`:**

Add a catch-all route handler at `apps/dashboard/src/app/api/[...path]/route.ts`. For any incoming request it must:

1. Read the Better Auth session cookie
2. Use `@repo/bff` `resolveSessionUser` to validate it (same `findSession` call via `@repo/prisma`)
3. Mint a short-lived RS256 JWT with the user's claims via `@repo/auth/jwt` `signRs256`
4. Use `@repo/bff` `forwardWithJwt` to proxy the request to `apps/api`
5. Return 401 if the session is missing or expired

The route handler must support all HTTP methods (GET, POST, PATCH, DELETE) and forward query strings, headers, and body unchanged (except for replacing `Authorization`).

**TanStack Query setup:** install `@tanstack/react-query` in `apps/dashboard`. Add a `QueryClientProvider` wrapper (client component) in the dashboard layout with `staleTime: 30_000` as the default. Add `@.docs/tanstack-query.md` to the docs folder (already done — verify it is present and correct).

### Acceptance criteria

- [ ] `packages/bff` exists with `extractSessionToken`, `resolveSessionUser`, and `forwardWithJwt` exports
- [ ] `apps/bff` imports these from `@repo/bff`; its existing integration tests still pass unchanged
- [ ] Next.js catch-all route at `/api/[...path]` forwards authenticated requests to `apps/api` with a valid JWT
- [ ] Unauthenticated requests to `/api/[...path]` return 401
- [ ] `QueryClientProvider` is wired into the dashboard layout
- [ ] `pnpm format && pnpm format:check && pnpm lint && pnpm check-types && pnpm test` all pass

### Blocked by

None — can start immediately

---

## Issue 2: Flag create + list (end-to-end)

### What to build

Add flag creation and listing, end-to-end from `apps/api` through to the dashboard UI.

**`apps/api` endpoints:**

`POST /projects/:projectId/flags`

- Body: `{ key: string, name: string }`
- Validates that `key` matches `^[a-z0-9-]+$` and is unique within the project (`@@unique([projectId, key])`)
- Creates the `Flag` row
- Eagerly creates a `FlagState` row for every existing `Environment` in the project, all with `status: inactive`, `type: boolean`
- Appends an `AuditEvent` with `action: "flag.created"`, `meta: { key, name }`
- Returns the created flag

`GET /projects/:projectId/flags?environmentId=<id>`

- Returns all flags for the project with their `FlagState` for the given environment (including `status`)
- Excludes `archived` flags by default (archived flags are hidden from the list)
- Requires `environmentId` query param; returns 400 if missing

**Dashboard `/projects/[projectId]/flags` page:**

- Environment selector (dropdown or tab strip) at the top, populated from the project's environments
- Flag list: each row shows flag name, key, status badge (active / inactive), and a disabled quick-toggle button (placeholder — wired in Issue 3)
- Empty state when no flags exist
- Create flag form at the bottom (visible to `canManage` only): two fields — `name` and `key` (key auto-populates as a slug from name, remains editable)
- TanStack Query: `useQuery` for the list keyed as `['projects', projectId, 'flags', { environmentId }]`; `useMutation` for creation with `onSuccess` invalidation of `['projects', projectId, 'flags']`
- Link from the project detail page to `/projects/[projectId]/flags`

### Acceptance criteria

- [ ] `POST /projects/:projectId/flags` creates the flag and one `FlagState` per existing environment
- [ ] Duplicate `key` within the same project returns 409
- [ ] `GET /projects/:projectId/flags?environmentId=` returns flags with status for that environment
- [ ] Archived flags are excluded from the list response
- [ ] `AuditEvent` with `action: "flag.created"` is written on creation
- [ ] `/projects/[projectId]/flags` page renders with environment selector and flag list
- [ ] Create form: key auto-derives from name (slugified), both fields are independently editable
- [ ] Submitting the create form adds the flag to the list without a full page reload (TanStack Query invalidation)
- [ ] `canManage` users see the create form; `viewer` users do not
- [ ] `pnpm format && pnpm format:check && pnpm lint && pnpm check-types && pnpm test` all pass

### Blocked by

Issue 1 (`packages/bff` + Next.js API route scaffold + TanStack Query setup)

---

## Issue 3: Quick toggle (end-to-end)

### What to build

Add the ability to toggle a flag between `active` and `inactive` for a specific environment, from `apps/api` down to the toggle button in the flags list.

**`apps/api` endpoint:**

`PATCH /projects/:projectId/flags/:flagId/environments/:environmentId`

- Body: `{ status: "active" | "inactive" }`
- Finds the `FlagState` for `(flagId, environmentId)`; returns 404 if absent
- Rejects the toggle if the flag's current status is `archived` (returns 409)
- Updates `FlagState.status` to the requested value
- Appends an `AuditEvent` with `action: "flag.toggled"`, `meta: { environmentId, status }`
- Returns the updated `FlagState`

**Dashboard toggle in the flags list:**

- Each flag row has a toggle (checkbox or switch) showing the current status for the selected environment
- Disabled and visually muted when `status === "archived"` or when the user lacks `canManage`
- Clicking optimistically updates the UI; on error reverts and shows an inline error message
- TanStack Query mutation keyed to invalidate `['projects', projectId, 'flags', { environmentId }]` on success

### Acceptance criteria

- [ ] `PATCH .../environments/:environmentId` with `status: "active"` activates the flag in that environment only
- [ ] Toggling an archived flag returns 409
- [ ] `AuditEvent` with `action: "flag.toggled"` is written on each toggle
- [ ] Toggle button reflects the current status and updates immediately on click (optimistic)
- [ ] Toggle is disabled for `viewer` role and for archived flags
- [ ] `pnpm format && pnpm format:check && pnpm lint && pnpm check-types && pnpm test` all pass

### Blocked by

Issue 2 (flag create + list)

---

## Issue 4: Flag detail + rename (end-to-end)

### What to build

Add the flag detail page and rename capability, end-to-end.

**`apps/api` endpoints:**

`GET /projects/:projectId/flags/:flagId`

- Returns the flag (`id`, `key`, `name`, `createdAt`, `updatedAt`)
- Includes all `FlagState` rows (one per environment) with `environmentId`, `environmentName`, `status`
- Includes the 50 most recent `AuditEvent` rows ordered by `createdAt desc`, each with `action`, `meta`, `createdAt`, and the actor's `userId` + `name`

`PATCH /projects/:projectId/flags/:flagId`

- Body: `{ name: string }`
- Updates `Flag.name` only — `key` is never touched
- Appends `AuditEvent` with `action: "flag.renamed"`, `meta: { oldName, newName }`
- Returns the updated flag

**Dashboard `/projects/[projectId]/flags/[flagId]` page:**

- Header: flag name + key (key shown read-only in `font-mono`)
- Rename form: single `name` field, inline save button, visible to `canManage` only
- Per-environment status table: one row per environment, status badge, toggle button (same logic as the list toggle — wired via the same TanStack Query mutation from Issue 3)
- Audit log: chronological list (newest first) of audit events — actor name, action label, timestamp, relevant meta rendered as human-readable text
- Back link to `/projects/[projectId]/flags`
- Archive/delete buttons are placeholders in this issue (wired in Issue 5)
- TanStack Query: `useQuery` keyed as `['projects', projectId, 'flags', flagId]`; rename `useMutation` with `onSuccess` invalidation of the same key

### Acceptance criteria

- [ ] `GET .../flags/:flagId` returns flag, all environment states, and last 50 audit events
- [ ] `PATCH .../flags/:flagId` updates `name` only; `key` is unchanged
- [ ] `AuditEvent` with `action: "flag.renamed"` is written with `oldName` and `newName` in meta
- [ ] Detail page renders flag name, key, per-environment status table, and audit log
- [ ] Rename form is visible to `canManage`; submission updates the heading without full reload
- [ ] Status table toggle works identically to the list-view toggle
- [ ] Audit log renders actor name, action, and timestamp for each event
- [ ] `pnpm format && pnpm format:check && pnpm lint && pnpm check-types && pnpm test` all pass

### Blocked by

Issue 2 (flag create + list)

---

## Issue 5: Archive + delete (end-to-end)

### What to build

Add archive/unarchive and delete to the flag detail page, end-to-end.

**`apps/api` endpoints:**

`POST /projects/:projectId/flags/:flagId/archive`

- Sets all `FlagState.status` to `archived` for this flag (across every environment)
- Appends `AuditEvent` with `action: "flag.archived"`, `meta: {}`
- Returns the updated flag

`POST /projects/:projectId/flags/:flagId/unarchive`

- Sets all `FlagState.status` to `inactive` for this flag
- Appends `AuditEvent` with `action: "flag.unarchived"`, `meta: {}`
- Returns the updated flag

`DELETE /projects/:projectId/flags/:flagId`

- Reads `flag.key` and `flag.name` before deletion (for the audit meta)
- Deletes the `Flag` row; cascade removes all `FlagState` and `AuditEvent` rows
- Does **not** write a post-delete audit event (the row is gone); instead the caller receives a 204 and the UI redirects away
- Note: if a pre-deletion audit trail is required in future, an `AuditEvent` should be written to a project-level log — out of scope for this slice

**Dashboard detail page additions:**

- **Archive button** (visible to `canManage`, hidden when already archived): on click, sends the archive request and invalidates the flag detail + list queries; status table shows all environments as `archived`
- **Unarchive button** (visible to `canManage`, shown only when all states are `archived`): restores all to `inactive`
- **Delete section** (visible to `canManage` only): red-bordered panel at the bottom of the page. User must type the flag `name` exactly to enable the delete button. On success, redirects to `/projects/[projectId]/flags`. Uses the same type-to-confirm pattern as project and environment deletion.
- Archived flags show a visible `archived` badge in the page header; all environment toggles are disabled while archived.

### Acceptance criteria

- [ ] `POST .../archive` sets all `FlagState` rows to `archived` and writes `flag.archived` audit event
- [ ] `POST .../unarchive` sets all `FlagState` rows to `inactive` and writes `flag.unarchived` audit event
- [ ] `DELETE .../flags/:flagId` removes the flag and all related rows; returns 204
- [ ] Archive button is disabled / hidden when flag is already archived
- [ ] Unarchive button is shown only when the flag is archived
- [ ] Delete confirmation requires typing the flag name exactly; button is disabled otherwise
- [ ] After deletion the user is redirected to `/projects/[projectId]/flags`
- [ ] Archived badge is visible in the page header while archived; environment toggles are disabled
- [ ] `canManage` guard enforced on all three endpoints and all three UI actions
- [ ] `pnpm format && pnpm format:check && pnpm lint && pnpm check-types && pnpm test` all pass

### Blocked by

Issue 4 (flag detail + rename)
