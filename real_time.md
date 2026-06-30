# Slice 7 — SSE Stream + Real-Time SDK Updates

## Design decisions

These decisions were finalised before these issues were written. Do not re-litigate them; refer to the ADRs if you want to understand the trade-offs.

| Decision              | Value                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| Broadcast bus         | In-process Node.js `EventEmitter` singleton — see [ADR-0001](docs/adr/0001-sse-broadcast-in-memory-emitter.md)  |
| SSE helper            | Hono `streamSSE` (`hono/streaming`)                                                                             |
| JWT validation        | Once at connect time only — see [ADR-0002](docs/adr/0002-sse-jwt-one-time-validation.md)                        |
| Ring buffer scope     | Per `projectId`, 500 events max (fixed count), evict oldest on overflow                                         |
| Event IDs             | Single global monotonic counter (`let nextEventId = 0`), incremented per emitted event                          |
| `Last-Event-ID`       | Supported; stale/absent ID → fall back to fresh `snapshot`                                                      |
| Snapshot race         | Subscribe to EventEmitter **before** querying DB; buffer events during query; send snapshot then flush buffer   |
| Server-side filtering | Each SSE frame is sent only if `event.environmentId === null \|\| event.environmentId === client.environmentId` |
| Heartbeat             | SSE comment frame every 30 s                                                                                    |
| `retry`               | `retry: 1000` sent once on connect                                                                              |
| Reconnect (SDK)       | Exponential backoff — 1 s initial, 2× multiplier, 30 s max, ±20% jitter                                         |
| Testing               | White-box: emit directly on the EventEmitter singleton; assert on `ReadableStream` chunks from `app.request()`  |
| Schema location       | `packages/api`                                                                                                  |

## Event taxonomy

| SSE `event:` field | Trigger                                      | Payload shape                                         |
| ------------------ | -------------------------------------------- | ----------------------------------------------------- |
| `snapshot`         | connect or stale reconnect                   | `{ flags: Array<{ key: string; enabled: boolean }> }` |
| `flag_created`     | `POST /projects/:projectId/flags`            | `{ key: string; enabled: boolean }`                   |
| `flag_updated`     | `PATCH /:flagId/environments/:environmentId` | `{ key: string; enabled: boolean }`                   |
| `flag_archived`    | `POST /:flagId/archive`                      | `{ key: string }`                                     |
| `flag_unarchived`  | `POST /:flagId/unarchive`                    | `{ key: string; enabled: boolean }`                   |
| `flag_deleted`     | `DELETE /:flagId`                            | `{ key: string }`                                     |

`PATCH /:flagId` (rename) emits **no event** — the SDK cache has no `name` field.

## Internal event shape (ring buffer + EventEmitter)

```ts
type FlagStreamEvent = {
  id: number; // global monotonic counter
  projectId: string;
  environmentId: string | null; // null = applies to all environments
  type:
    | 'flag_created'
    | 'flag_updated'
    | 'flag_archived'
    | 'flag_unarchived'
    | 'flag_deleted';
  payload: { key: string; enabled?: boolean };
};
```

`flag_updated` always carries a specific `environmentId`. All other event types use `environmentId: null`.

## Schema additions (packages/api)

Add to `packages/api/src/schemas/flags.ts` alongside the existing `FlagConfigSchema` and `FlagSnapshotResponseSchema`:

```ts
// Upsert events — identical shape today, kept separate for semantic clarity
export const FlagCreatedEventSchema = Schema.Struct({
  key: Schema.String,
  enabled: Schema.Boolean,
});
export type FlagCreatedEvent = Schema.Schema.Type<
  typeof FlagCreatedEventSchema
>;

export const FlagUpdatedEventSchema = Schema.Struct({
  key: Schema.String,
  enabled: Schema.Boolean,
});
export type FlagUpdatedEvent = Schema.Schema.Type<
  typeof FlagUpdatedEventSchema
>;

export const FlagUnarchivedEventSchema = Schema.Struct({
  key: Schema.String,
  enabled: Schema.Boolean,
});
export type FlagUnarchivedEvent = Schema.Schema.Type<
  typeof FlagUnarchivedEventSchema
>;

// Remove events
export const FlagArchivedEventSchema = Schema.Struct({ key: Schema.String });
export type FlagArchivedEvent = Schema.Schema.Type<
  typeof FlagArchivedEventSchema
>;

export const FlagDeletedEventSchema = Schema.Struct({ key: Schema.String });
export type FlagDeletedEvent = Schema.Schema.Type<
  typeof FlagDeletedEventSchema
>;
```

Export all from `packages/api/src/index.ts`.

---

## Issue 1 — SSE stream: snapshot on connect

### What to build

Add `GET /v1/flags/stream` to `apps/api`. When an SDK client connects, the server immediately sends a `snapshot` SSE event containing the complete list of active flags for the client's environment, then holds the connection open with 30-second heartbeat comment frames. A `retry: 1000` directive is sent once on connect.

This issue covers the connection and snapshot path only — live event delivery and `Last-Event-ID` replay are handled in Issues 2 and 3.

**Key implementation notes:**

- The route lives in `apps/api/src/routes/sdk.ts`, registered on the existing `sdkRouter` (`/v1`). Full path becomes `GET /v1/flags/stream`.
- JWT is validated by the existing middleware. Inside the handler, check `isSdkClaims(auth)` and return `new Forbidden().toResponse()` if not.
- Use `streamSSE` from `hono/streaming`. Pass an `onAbort` / cleanup callback that clears the heartbeat `setInterval`.
- The EventEmitter singleton lives at `apps/api/src/events/emitter.ts`. Create it in this issue (it will be subscribed to in Issue 2). A typed Node.js `EventEmitter` using the `FlagStreamEvent` generic is preferred over a plain untyped one.
- **Subscribe-first**: register the EventEmitter listener before the DB query. Buffer any events received during the query into a local array. After sending the snapshot, flush the buffer in emission order. (The listener can be a no-op that just pushes to the buffer for now — live delivery via `stream.writeSSE` is wired in Issue 2.)
- The `snapshot` payload is encoded through the existing `FlagSnapshotResponseSchema` (same shape as `GET /v1/flags`). Archived flags are excluded.
- Heartbeat: `setInterval(() => stream.write(': keep-alive\n\n'), 30_000)`.
- `retry: 1000` is written once as raw SSE: `stream.write('retry: 1000\n\n')` before the first event.

### Acceptance criteria

- [ ] `GET /v1/flags/stream` returns `Content-Type: text/event-stream`
- [ ] On connect, the client receives `event: snapshot` with `data` containing `{ flags: [...] }` matching the environment's active flags (archived excluded)
- [ ] A 30-second heartbeat comment frame (`: keep-alive`) is sent while the connection is open
- [ ] `retry: 1000` appears once at the start of the stream
- [ ] Requests without a valid SDK JWT receive `401`
- [ ] The EventEmitter singleton module exists at `apps/api/src/events/emitter.ts`
- [ ] All new schemas are exported from `packages/api`
- [ ] `pnpm check-types`, `pnpm lint`, `pnpm test`, `pnpm build` all pass

### Blocked by

None — can start immediately.

---

## Issue 2 — Live flag event delivery

### What to build

Wire all five flag mutation handlers in `apps/api/src/routes/flags.ts` to emit `FlagStreamEvent`s onto the EventEmitter singleton after their DB writes complete. The SSE stream handler (from Issue 1) forwards these events to connected SDK clients, applying server-side environment filtering before writing each SSE frame.

After this issue, an SDK client connected to `GET /v1/flags/stream` sees real-time events whenever a flag changes in its environment.

**Key implementation notes:**

- Import the EventEmitter singleton from `apps/api/src/events/emitter.ts` in `flags.ts`.
- Emit after the DB transaction completes — not before. On failure (exception thrown), do not emit.
- `flag_deleted`: the `DELETE /:flagId` handler calls `prisma.flag.delete()` which does not return the deleted row's `key`. Read the flag (`prisma.flag.findUnique`) before deleting to capture the `key`. If the flag is not found, return `FlagNotFound` as before (no emit).
- `flag_updated` (toggle): `environmentId` comes from `c.req.param()` and is already validated. Use it as the event's `environmentId`.
- All other emitted events use `environmentId: null`.
- **Global counter**: the module at `apps/api/src/events/emitter.ts` (or a sibling `ringBuffer.ts`) owns `let nextEventId = 0`. Each `emit()` increments it and stamps the event's `id`.
- **SSE route wiring** (update from Issue 1): in the EventEmitter listener registered during connect, call `stream.writeSSE({ id: String(event.id), event: event.type, data: JSON.stringify(event.payload) })` after applying the environment filter. Buffer events that arrive between subscribe and snapshot flush must also be delivered this way after the snapshot is sent.
- **Server-side filtering**: before writing each SSE frame, check `event.environmentId === null || event.environmentId === claims.environmentId`. Drop the event silently if it doesn't match.

### Acceptance criteria

- [ ] Toggling a flag emits a `flag_updated` event only to SSE clients in the same environment; clients in other environments do not receive it
- [ ] Creating a flag emits `flag_created` (with `enabled: false`) to all SSE clients in the project
- [ ] Archiving a flag emits `flag_archived` (with only `key`) to all SSE clients in the project
- [ ] Unarchiving a flag emits `flag_unarchived` (with `enabled: false`) to all SSE clients in the project
- [ ] Deleting a flag emits `flag_deleted` (with only `key`) to all SSE clients in the project
- [ ] Renaming a flag emits no SSE event
- [ ] Each SSE event frame includes a monotonically increasing numeric `id:` field
- [ ] Events emitted during the DB-query window (between subscribe and snapshot send) are delivered in order after the snapshot
- [ ] `pnpm check-types`, `pnpm lint`, `pnpm test`, `pnpm build` all pass

### Blocked by

Issue 1.

---

## Issue 3 — Last-Event-ID replay

### What to build

Add a per-project ring buffer that retains the last 500 `FlagStreamEvent`s. When an SDK client reconnects with a `Last-Event-ID` header, the server replays all buffered events for that project with an ID greater than the given value (filtered by `environmentId`), then switches to live delivery. If the `Last-Event-ID` is absent or older than the oldest buffered event, the server falls back to sending a fresh `snapshot` (existing Issue 1 / 2 path).

After this issue, SDK clients that briefly disconnect (network blip, server restart) can resume exactly where they left off without re-fetching a full snapshot, provided they reconnect within the buffer window.

**Key implementation notes:**

- Ring buffer: `Map<string, FlagStreamEvent[]>` keyed by `projectId`. After every emit, `push` the event; if `buf.length > 500`, `buf.shift()`.
- The buffer is owned by the same module as the EventEmitter singleton (`apps/api/src/events/emitter.ts` or `apps/api/src/events/ringBuffer.ts`). Both the emit path (Issues 1–2) and the SSE connect path read from it.
- Parse `Last-Event-ID` from the incoming request header (`c.req.header('Last-Event-ID')`). Parse as integer; `NaN` or missing → treat as absent.
- **Replay path**:
  1. Read the buffer for `claims.projectId`.
  2. Find events with `id > lastEventId`.
  3. Apply env filter (`event.environmentId === null || event.environmentId === claims.environmentId`).
  4. If any events exist, write them to the stream in order, then switch to live delivery (subscribe to EventEmitter as in Issues 1–2 but skip the snapshot).
  5. If no events exist after the given ID (buffer doesn't go back that far, or buffer is empty), fall through to the snapshot path.
- **Subscribe-first applies to the replay path too**: subscribe to the EventEmitter before reading the buffer to avoid a gap between the last replayed event and the first live event.
- **Snapshot fallback** (absent or stale ID): the existing connect flow from Issues 1–2 — subscribe, query DB, send snapshot, flush buffer.
- The `id:` sent in each replayed SSE frame is the event's original global ID (not reassigned).

### Acceptance criteria

- [ ] A client that reconnects with a valid `Last-Event-ID` receives only events that occurred after that ID (none replayed before it)
- [ ] Replayed events are filtered by `environmentId` (same rule as live delivery)
- [ ] A client with an absent `Last-Event-ID` receives a fresh `snapshot`
- [ ] A client with a `Last-Event-ID` older than the oldest buffered event receives a fresh `snapshot`
- [ ] No gap exists between the last replayed event and the first live event (subscribe-first holds on the replay path)
- [ ] The ring buffer never exceeds 500 events per project
- [ ] `pnpm check-types`, `pnpm lint`, `pnpm test`, `pnpm build` all pass

### Blocked by

Issue 2.
