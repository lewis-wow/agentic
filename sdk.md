# Slice 5 — SDK API: Flag Config Snapshot

Issues derived from the design session. Publish in order — blockers first.

---

## Issue 1 — Prefactor: Migrate SDK routing from `/sdk/*` to `/v1/*`

### What to build

The existing SDK auth plumbing in `apps/bff` and `apps/api` uses a `/sdk/*` path prefix with no live handlers behind it. Rename it to `/v1/*` across both apps and their tests before the real endpoint is added.

In `apps/bff`: update the `sdkAuth` middleware and `forwardWithJwt` catch-all from `/sdk/*` to `/v1/*`.  
In `apps/api`: update the `jwtAuth` middleware registration from `/sdk/*` to `/v1/*`.  
In `apps/bff/__tests__/integration/sdk-auth.test.ts`: update the dummy route and all request URLs from `/sdk/flags` to `/v1/flags`.

No new behaviour. All existing SDK auth tests must continue to pass after the rename.

### Acceptance criteria

- [ ] `apps/bff/src/index.ts` registers `sdkAuth` and `forwardWithJwt` on `/v1/*`; no `/sdk/*` references remain
- [ ] `apps/api/src/index.ts` registers `jwtAuth` on `/v1/*`; no `/sdk/*` references remain
- [ ] `apps/bff/__tests__/integration/sdk-auth.test.ts` uses `/v1/flags` for its dummy route and all requests
- [ ] `pnpm test`, `pnpm lint`, and `pnpm check-types` pass with zero errors

### Blocked by

None — can start immediately.

---

## Issue 2 — Feature: `GET /v1/flags` flag config snapshot endpoint

### What to build

Add the first live SDK endpoint: `GET /v1/flags`. An SDK client authenticates with its environment API key (`Authorization: Bearer env_<id>.<secret>`), the BFF exchanges it for an RS256 JWT carrying `{ projectId, environmentId, projectRole: 'sdk-client' }`, and `apps/api` returns the full flag snapshot for that environment.

**New `packages/api` package**

Create a new `packages/api` workspace package. It owns Effect Schema definitions for all `apps/api` request/response shapes. For this slice, export:

```ts
// packages/api/src/schemas/flags.ts
import { Schema } from 'effect';

export const FlagConfigSchema = Schema.Struct({
  key: Schema.String,
  enabled: Schema.Boolean,
});
export type FlagConfig = Schema.Schema.Type<typeof FlagConfigSchema>;

export const FlagSnapshotResponseSchema = Schema.Struct({
  flags: Schema.Array(FlagConfigSchema),
});
export type FlagSnapshotResponse = Schema.Schema.Type<
  typeof FlagSnapshotResponseSchema
>;
```

Both the schema and its inferred type are always exported together — even when the type has no consumer yet.

**`apps/api` route**

Add `apps/api/src/routes/sdk.ts` with a single handler for `GET /flags`. The handler:

1. Guards with `isSdkClaims(auth)` — returns 403 for any non-SDK token.
2. Queries all flags for `claims.projectId`, including each flag's state for `claims.environmentId`.
3. Filters out flags whose state for this environment has `status === 'archived'`.
4. Maps each remaining flag to `{ key, enabled: state.status === 'active' }`.
5. Encodes the result through `FlagSnapshotResponseSchema` and returns `{ flags }`.

Mount the router at `/v1` in `apps/api/src/index.ts` under the existing `/v1/*` JWT middleware added in Issue 1.

**Tests**

Add `apps/api/__tests__/integration/sdk-flags.test.ts`. Mock Prisma (following the pattern in `flags.test.ts`). Cover:

- Valid SDK JWT → returns `{ flags: FlagConfig[] }` with correct `enabled` values.
- Active flags map to `enabled: true`; inactive flags map to `enabled: false`.
- Archived flags are excluded from the response.
- Project JWT (non-SDK) → 403.
- Missing/invalid JWT → 401 (already covered by the JWT middleware, but assert it).
- Empty flag list → `{ flags: [] }` with 200.

### Acceptance criteria

- [ ] `packages/api` workspace package exists with `FlagConfigSchema`, `FlagConfig`, `FlagSnapshotResponseSchema`, `FlagSnapshotResponse` exported from its barrel
- [ ] `apps/api/src/routes/sdk.ts` handles `GET /flags` with `isSdkClaims` guard
- [ ] Response is encoded through `FlagSnapshotResponseSchema` before sending
- [ ] Archived flags are excluded; active → `enabled: true`; inactive → `enabled: false`
- [ ] SDK JWT from `apps/bff` reaches `apps/api` and returns a correct snapshot end-to-end (verified in integration test)
- [ ] Project-scoped JWT returns 403; missing token returns 401
- [ ] `pnpm test`, `pnpm lint`, and `pnpm check-types` pass with zero errors

### Blocked by

Issue 1 — Migrate SDK routing from `/sdk/*` to `/v1/*`
