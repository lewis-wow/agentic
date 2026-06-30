# Slice 10 — Audit Log Timeline (Dashboard)

## Architecture decisions (agreed in design session)

1. **Separate endpoint**: Audit log lives at `GET /projects/:projectId/flags/:flagId/audit-log?page=1&limit=25` — not embedded in the flag detail response. `GET /:flagId` drops the `auditLog` field entirely.
2. **Offset-based pagination**: Page-number table UI. API returns `{ events, total, page, limit }`; the dashboard derives `totalPages = Math.ceil(total / limit)`.
3. **25 events per page**, newest first (`orderBy: { createdAt: 'desc' }`).
4. **`packages/pagination`** is a new shared package with pure server-side utilities (`parsePaginationParams`, `buildPrismaPage`, `buildPageMeta`) and a client-side React hook (`usePaginatedQuery`) wrapping TanStack Query's `useQuery`.
5. **Effect Schemas** in `packages/api`: `AuditLogEntrySchema`, `AuditLogPageSchema`, and an updated `FlagDetailSchema` (without `auditLog`). `meta` is typed as `Schema.Record({ key: Schema.String, value: Schema.Unknown })`.
6. **`environmentName` stored at write time**: `flag.toggled` and `flag.rollout_updated` audit event meta must include `environmentName` alongside `environmentId`. Old rows without `environmentName` fall back to displaying the raw `environmentId` UUID.
7. **All 7 action types** produce meaningful detail text via `formatMeta`:

   | action                 | detail text                               |
   | ---------------------- | ----------------------------------------- |
   | `flag.created`         | `"my-flag-key"`                           |
   | `flag.renamed`         | `"old-name" → "new-name"`                 |
   | `flag.toggled`         | `production: active` (falls back to UUID) |
   | `flag.rollout_updated` | `production: percentage_rollout 40%`      |
   | `flag.rules_updated`   | `production: rules updated`               |
   | `flag.archived`        | _(empty — label is self-explanatory)_     |
   | `flag.unarchived`      | _(empty — label is self-explanatory)_     |

8. **Table columns**: Action | Detail | User | When.
9. **Timestamp format**: cell shows absolute date via `Intl.DateTimeFormat` (e.g. "Jun 30, 2026, 2:34 PM"); `title` attribute contains relative time (e.g. "2 hours ago").

---

## Issue 1: `packages/pagination` — shared pagination utilities + React hook

### What to build

Create `packages/pagination` as a new shared internal package. The server-side exports are pure TypeScript with no framework dependencies. The client-side export wraps TanStack Query.

**Server-side exports:**

- `parsePaginationParams(query: Record<string, string>, defaults?: { limit: number }) → { page: number; limit: number }` — parses `page`/`limit` query params, coerces to integers, clamps `limit` to 1–100 and `page` to ≥ 1.
- `buildPrismaPage(page: number, limit: number) → { skip: number; take: number }` — converts to Prisma's `skip`/`take`.
- `buildPageMeta(total: number, page: number, limit: number) → { total: number; page: number; limit: number; totalPages: number }` — assembles the pagination metadata envelope.

**Shared type (exported, used by both server and client):**

```ts
type PagedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};
```

**Client-side React export:**

```ts
usePaginatedQuery<T>(options: {
  queryKey: unknown[];
  queryFn: (page: number) => Promise<PagedResponse<T>>;
  limit?: number;
}) → {
  data: T[] | undefined;
  page: number;
  setPage: (p: number) => void;
  isPending: boolean;
  error: Error | null;
  totalPages: number;
}
```

The hook manages `page` state internally, resets to page 1 when `queryKey` changes, and passes the current `page` to `queryFn` on each call.

### Acceptance criteria

- [ ] `packages/pagination` exists and is referenced in the monorepo workspace
- [ ] Exports `parsePaginationParams`, `buildPrismaPage`, `buildPageMeta`, `usePaginatedQuery`, and `PagedResponse`
- [ ] `parsePaginationParams` clamps correctly; missing params use provided defaults
- [ ] `usePaginatedQuery` re-fetches when `page` changes; `setPage` updates the page; `queryKey` change resets to page 1
- [ ] Unit tests cover all three server-side utilities
- [ ] `pnpm format && pnpm format:check && pnpm lint && pnpm check-types && pnpm test` all pass

### Blocked by

None — can start immediately

---

## Issue 2: Audit log timeline — end-to-end

### What to build

Deliver the full audit log timeline for the flag detail view: new paginated API endpoint, schema definitions, write-path corrections for environment names, and the dashboard paginated table.

**Schema changes in `packages/api`:**

Add `AuditLogEntrySchema`:

```ts
Schema.Struct({
  id: Schema.String,
  action: Schema.String,
  meta: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  createdAt: Schema.String,
  userId: Schema.String,
  userName: Schema.String,
});
```

Add `AuditLogPageSchema` composing `AuditLogEntrySchema[]` with `total`, `page`, `limit`. Update `FlagDetailSchema` to remove the `auditLog` field. Export both schemas and their inferred types.

**New API endpoint in `apps/api`:**

`GET /projects/:projectId/flags/:flagId/audit-log`

- Query params: `page` (default 1), `limit` (default 25). Parse with `parsePaginationParams` from `packages/pagination`.
- Runs `prisma.auditEvent.findMany(...)` and `prisma.auditEvent.count(...)` in `Promise.all`, ordered `createdAt desc`.
- Each event includes `user: { id, name }` via Prisma `include`.
- Returns `{ events: AuditLogEntry[], total, page, limit }`.
- Auth: project JWT required (all project members can read; no `canManage` restriction).
- `GET /:flagId` handler: remove the `auditLog` include and drop the field from its response.

**Audit event write-path corrections in `apps/api`:**

For `flag.toggled` and `flag.rollout_updated` events the route already has the `FlagState` loaded with its `environment`. Add `environmentName: flagState.environment.name` to `meta` in both audit event creates. This requires including `environment: { select: { id: true, name: true } }` in the `flagState` query if not already present.

**Dashboard changes in `apps/dashboard`:**

- Drop `auditLog` from the `FlagDetail` type and from `useFlagDetail`'s response handling.
- Add `useAuditLog(projectId: string, flagId: string)` hook using `usePaginatedQuery` from `packages/pagination`. The `queryFn` fetches `/api/projects/:projectId/flags/:flagId/audit-log?page=<n>&limit=25` and maps the response to `PagedResponse<AuditLogEntry>`.
- Add an `auditLog` query key factory to `flagKeys`:
  ```ts
  auditLog: (projectId: string, flagId: string) =>
    ['projects', projectId, 'flags', flagId, 'audit-log'] as const;
  ```
- Replace `AuditLogSection`'s simple `<ul>` with a paginated `<table>`.
- Table columns: **Action** | **Detail** | **User** | **When**.
- `formatMeta(action, meta)` covers all 7 action types per the table in the architecture decisions above. Falls back gracefully when a field is missing in `meta`.
- Timestamp cell: `Intl.DateTimeFormat` absolute string (locale-aware, no seconds). `title` attribute: relative time string computed client-side (e.g. `"2 hours ago"`).
- Page navigation rendered below the table: Previous button, page number buttons, Next button. Driven by `page`, `setPage`, and `totalPages` from `usePaginatedQuery`. Previous/Next disabled at boundaries.

### Acceptance criteria

- [ ] `GET .../audit-log?page=1&limit=25` returns 25 events with `total`, `page`, `limit`
- [ ] Requesting `page=2` returns the correct `skip` window (events 26–50)
- [ ] `GET /:flagId` no longer includes an `auditLog` field
- [ ] `AuditLogEntrySchema`, `AuditLogPageSchema`, updated `FlagDetailSchema` are exported from `packages/api`
- [ ] `flag.toggled` and `flag.rollout_updated` events written after this change include `environmentName` in meta
- [ ] Dashboard table renders Action, Detail, User, When columns
- [ ] `formatMeta` returns non-empty detail text for `flag.created`, `flag.renamed`, `flag.toggled`, `flag.rollout_updated`, `flag.rules_updated`
- [ ] `flag.toggled` / `flag.rollout_updated` detail shows environment name for new rows; falls back to the raw UUID for old rows (no crash)
- [ ] Timestamp cell shows formatted absolute date; hovering reveals relative time via `title`
- [ ] Page navigation controls work: navigating pages re-fetches and re-renders the table
- [ ] Previous button disabled on page 1; Next button disabled on last page
- [ ] `pnpm format && pnpm format:check && pnpm lint && pnpm check-types && pnpm test` all pass

### Blocked by

Issue 1 (`packages/pagination`)
