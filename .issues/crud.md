# Slice 3 — Project & Environment CRUD

## Issue 1: Schema migration + `@repo/auth/api-key` module

### What to build

Migrate the `Environment` table to a hashed API key model and expose key generation/verification as a shared auth primitive.

**Schema changes (`packages/prisma`):**

- Remove `apiKey String @unique @default(cuid())` from `Environment`
- Add `apiKeyId String @unique` — the lookup handle, embedded in the full key
- Add `apiKeyHash String` — bcrypt hash of the secret portion only
- Add `@@unique([projectId, name])` to `Environment` — environment names must be unique within a project
- Migration must delete all existing `Environment` rows before altering columns (no production data; existing keys are unrecoverable)

**New `@repo/auth/api-key` module (`packages/auth/src/apiKey.ts`, subpath export `@repo/auth/api-key`):**

Key format: `env_<apiKeyId>.<secret>`

- `apiKeyId` — `crypto.randomBytes(16).toString('hex')` (32 hex chars), stored plaintext in DB for indexed lookup
- `secret` — `crypto.randomBytes(32).toString('hex')` (64 hex chars), bcrypt-hashed at cost 10 and stored as `apiKeyHash`

```ts
// Shape of the module — not a working snippet, just the contract
generateApiKey(): { fullKey: string; apiKeyId: string; apiKeyHash: string }
verifyApiKey(args: { fullKey: string; apiKeyHash: string }): Promise<boolean>
// verifyApiKey splits fullKey on '.', takes the secret portion, bcrypt.compares against apiKeyHash
```

Add `bcrypt` + `@types/bcrypt` as dependencies of `@repo/auth`.

### Acceptance criteria

- [ ] `Environment` table has `apiKeyId` (unique index) and `apiKeyHash`; `apiKey` column is gone
- [ ] `@@unique([projectId, name])` constraint exists on `Environment`
- [ ] Migration SQL deletes all environment rows before the column changes
- [ ] `generateApiKey()` returns a key in `env_<apiKeyId>.<secret>` format with a valid bcrypt hash
- [ ] `verifyApiKey()` returns `true` for a valid key and `false` for a tampered one
- [ ] `@repo/auth/api-key` is listed as a subpath export in `packages/auth/package.json`
- [ ] Unit tests cover: round-trip generate→verify, wrong secret returns false, malformed key returns false
- [ ] `pnpm format && pnpm format:check && pnpm lint && pnpm check-types && pnpm test` all pass

### Blocked by

None — can start immediately

---

## Issue 2: BFF SDK middleware — bcrypt verification + LRU cache

### What to build

Update the BFF's SDK auth middleware to use the new hashed API key model. The middleware currently looks up `Environment` by plaintext `apiKey`; it must now parse the `apiKeyId` from the Bearer token, look up by that index, and verify the secret with bcrypt. Add an LRU cache to avoid bcrypt on every request.

**Lookup flow:**

1. Parse Bearer token → split on `.` → extract `apiKeyId` (part before first `.`, strip `env_` prefix) and `secret` (part after)
2. Check LRU cache keyed by `apiKeyId` → on hit, skip to JWT minting with cached `environmentId`
3. On cache miss: `findUnique({ where: { apiKeyId } })` → `verifyApiKey({ fullKey: token, apiKeyHash: row.apiKeyHash })`
4. On verify success: store `environmentId` in LRU cache (60s TTL), mint SDK JWT
5. On verify failure or missing row: 401

Use `lru-cache` package in the BFF. Cache up to 500 entries, TTL 60 seconds.

### Acceptance criteria

- [ ] BFF SDK middleware looks up `Environment` by `apiKeyId`, not `apiKey`
- [ ] Valid `env_<apiKeyId>.<secret>` Bearer token results in a minted SDK JWT (200)
- [ ] Tampered secret returns 401
- [ ] Unknown `apiKeyId` returns 401
- [ ] Missing Authorization header returns 401
- [ ] Second request with same valid key hits the LRU cache (bcrypt.compare not called again within TTL)
- [ ] Integration tests updated / added to cover all cases above
- [ ] `pnpm format && pnpm format:check && pnpm lint && pnpm check-types && pnpm test` all pass

### Blocked by

Issue 1 (schema + `@repo/auth/api-key`)

---

## Issue 3: Project CRUD

### What to build

Add project creation and deletion to the dashboard. Projects table is unchanged — no schema migration needed.

**Create project** — inline form on `/dashboard` (below the project list). One field: project name. Submits to `createProjectAction` server action guarded by `requireOwner`. On success, `revalidatePath('/dashboard')` shows the new project in the list.

**Delete project** — on the `/projects/[projectId]` page, a delete section guarded by OWNER role. Requires the user to type the project name exactly into a text input before the delete button becomes enabled. Submits to `deleteProjectAction` server action guarded by `requireOwner`. Cascades to all environments, flags, flag states, and project members (already set up in schema). Redirects to `/dashboard` after deletion.

Both actions are client components using `useActionState`.

### Acceptance criteria

- [ ] OWNER can create a project from `/dashboard`; it appears in the list immediately
- [ ] Non-owner (MEMBER) does not see the create form
- [ ] OWNER can delete a project from its detail page after typing the name to confirm
- [ ] Delete confirmation input must match the project name exactly; button stays disabled otherwise
- [ ] Non-owner does not see the delete section
- [ ] After deletion, all related environments / flags / members are gone (cascade)
- [ ] `pnpm format && pnpm format:check && pnpm lint && pnpm check-types && pnpm test` all pass

### Blocked by

None — can start immediately (runs in parallel with Issue 1)

---

## Issue 4: Environment CRUD + key management

### What to build

Add environment creation, deletion, and API key rotation to the project detail page. Environment names must be unique within a project (enforced by DB constraint from Issue 1). API keys are shown once at creation and rotation; they cannot be retrieved afterward.

**Create environment** — inline form on `/projects/[projectId]` page (below environment list). One field: environment name. Guarded by canManage (OWNER or project admin). Server action `createEnvironmentAction` calls `generateApiKey()`, stores `apiKeyId` + `apiKeyHash`, and returns `{ fullKey }` to the client.

**Delete environment** — each environment row has a delete button. Requires typing the environment name exactly to confirm. Server action `deleteEnvironmentAction` guarded by canManage. Cascades all `FlagState` rows for that environment. `revalidatePath` after.

**Rotate API key** — each environment row has a "Rotate key" button. Server action `rotateApiKeyAction` guarded by canManage. Generates a new key via `generateApiKey()`, replaces `apiKeyId` + `apiKeyHash` in the DB (old key immediately invalidated), returns `{ fullKey }`.

**Show-once key display** — client component holds `fullKey` in `useState`. When set (after create or rotate), renders a highlighted `<pre>` with the full key and a "Copy" button (uses `navigator.clipboard.writeText`). A warning states the key won't be shown again. Performing another action or navigating away clears it.

### Acceptance criteria

- [ ] OWNER and project admin can create an environment; viewers cannot see the form
- [ ] Creating an environment with a duplicate name within the same project returns a validation error
- [ ] After creation, the full key is displayed once with a copy button
- [ ] OWNER and project admin can delete an environment after typing its name to confirm
- [ ] After deletion, all flag states for that environment are gone
- [ ] OWNER and project admin can rotate a key; the full new key is displayed once with a copy button
- [ ] The old key is immediately invalid after rotation (BFF returns 401 for the old key)
- [ ] The show-once display clears when a new action is triggered or the component unmounts
- [ ] `pnpm format && pnpm format:check && pnpm lint && pnpm check-types && pnpm test` all pass

### Blocked by

Issue 1 (schema + `@repo/auth/api-key`)
