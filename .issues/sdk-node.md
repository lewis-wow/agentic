# Slice 6 — Node.js SDK: Boolean Flag Evaluation

## Architecture decisions (agreed in grilling session)

- **SDK targets the BFF, not `apps/api` directly.** The SDK sends `Authorization: Bearer env_<id>.<secret>` to `apps/bff`, which exchanges the API key for a short-lived RS256 JWT and proxies to `apps/api`. The SDK's `apiUrl` option is the BFF base URL. See `docs/adr/0001-sdk-routes-through-bff.md`.
- **`Exception` is HTTP-agnostic; `HttpException` adds HTTP concerns.** `packages/exception` splits into two classes: `Exception<TData>` (base — `code`, `message`, `data`, `cause`, no HTTP) and `HttpException<TData>` (extends `Exception`, adds `status`, `toResponse()`, `fromResponse()`). Every error in the monorepo extends `Exception`; only HTTP-carrying errors extend `HttpException`. See `docs/adr/0002-exception-http-exception-split.md`.
- **`packages/api-schemas` is renamed to `packages/api` (package name `@repo/api`).** It is the sibling package for `apps/api` domain contracts. Schemas live under `src/schemas/`.
- **`SdkClient` is a class.** Classes are permitted in this codebase.
- **`connect()` throws `ConnectFailed` on any failure.** Network errors and non-200 responses both reject the promise.
- **`isEnabled()` throws `ClientNotConnected` before `connect()` is called.** Unknown flag keys return `false` silently.
- **Internal cache is `Map<string, boolean>`.** Connected guard is a `private connected: boolean` field.
- **`isEnabled(key, context?)` signature is stable from day one.** The optional `context` parameter is ignored in Slice 6 (reserved for Slices 8–9: percentage rollout and targeting).
- **Unit tests use `vi.stubGlobal('fetch', ...)`.** Tests drive the full public `connect()` → `isEnabled()` flow without exposing internals.

---

## Issue 1 — Prefactor: Rename `packages/api-schemas` → `packages/api`

### What to build

The package `packages/api-schemas` (currently `@repo/api-schemas`) needs to be renamed so it matches the convention for app-scoped sibling packages. Rename the directory to `packages/api` and update the `name` field in `package.json` to `@repo/api`. Update every import across the monorepo that references `@repo/api-schemas` to use `@repo/api` instead. The schemas themselves (`FlagConfigSchema`, `FlagConfig`, `FlagSnapshotResponseSchema`, `FlagSnapshotResponse`) stay exactly where they are under `src/schemas/flags.ts`.

### Acceptance criteria

- [ ] Directory is `packages/api`; `package.json` `name` is `@repo/api`
- [ ] All imports of `@repo/api-schemas` across `apps/` and `packages/` are updated to `@repo/api`
- [ ] `pnpm build`, `pnpm lint`, and `pnpm check-types` pass with zero errors
- [ ] No reference to `api-schemas` remains anywhere in the repo

### Blocked by

None — can start immediately.

---

## Issue 2 — Prefactor: Split `Exception` into `Exception` + `HttpException`

### What to build

`packages/exception` currently bundles HTTP concepts (`status`, `toResponse()`, `fromResponse()`) directly into the base `Exception` class. This makes it impossible to use `Exception` outside an HTTP server context (e.g., in the Node.js SDK). Split the class into two:

**`Exception<TData>`** — HTTP-agnostic base. Keeps `code`, `message`, `data`, and `cause`. Loses `status`, `toResponse()`, and `fromResponse()`.

**`HttpException<TData>`** — extends `Exception<TData>`. Adds `static readonly status: number` (required, not optional), `toResponse(): Response`, and `static fromResponse({ json, status }): HttpException | null`.

Update every concrete exception subclass in `apps/api/src/exceptions/` to extend `HttpException` instead of `Exception`. The existing `static readonly status`, `static readonly code`, and `static readonly message` fields stay unchanged on each subclass.

Export both classes from `packages/exception/src/index.ts`. Also export `AnyException` and `AnyHttpException` as the respective unparameterised aliases.

### Acceptance criteria

- [ ] `Exception<TData>` has no `status`, `toResponse()`, or `fromResponse()` members
- [ ] `HttpException<TData>` extends `Exception<TData>` and carries those three
- [ ] All subclasses in `apps/api/src/exceptions/` extend `HttpException`
- [ ] `AnyException` and `AnyHttpException` are exported from the barrel
- [ ] All existing tests in `apps/api` and `apps/bff` still pass
- [ ] `pnpm build`, `pnpm lint`, `pnpm check-types`, and `pnpm test` pass with zero errors

### Blocked by

None — can start immediately. Issues 1 and 2 can be worked in parallel.

---

## Issue 3 — Feature: `packages/sdk-node` — Node.js SDK with boolean flag evaluation

### What to build

Create `packages/sdk-node` — the Node.js SDK for the flag platform. Users call `createClient()` to get an `SdkClient` instance, call `connect()` once to fetch the Flag Snapshot, then call `isEnabled(key)` on every flag check without a network hop.

**Public API (from grilling session):**

```ts
// Entry point
const client = createClient({ apiUrl: 'http://bff:3002', apiKey: 'env_...' });
await client.connect();

client.isEnabled('new-checkout'); // boolean flag
client.isEnabled('new-checkout', { userId: 'u-1' }); // context ignored in Slice 6
```

**`SdkClient` class internals:**

- `private connected: boolean` — starts `false`, set to `true` after a successful `connect()`
- `private flags: Map<string, boolean>` — populated from the Flag Snapshot on `connect()`
- `connect()`: `GET ${apiUrl}/v1/flags` with `Authorization: Bearer <apiKey>`, validates response with `Schema.decodeUnknownSync(FlagSnapshotResponseSchema)` from `@repo/api`, builds the Map, sets `connected = true`. Throws `ConnectFailed` on non-200 or network failure.
- `isEnabled(key, context?)`: throws `ClientNotConnected` if `!connected`; returns `this.flags.get(key) ?? false`

**Exception classes** (both extend `Exception` from `@repo/exception`, not `HttpException`):

- `ConnectFailed` — thrown by `connect()` on any failure
- `ClientNotConnected` — thrown by `isEnabled()` before `connect()` has succeeded

**Exports from barrel:** `createClient`, `SdkClient`, `CreateClientArgs`, `SdkClientOptions`, `ConnectFailed`, `ClientNotConnected`.

**Unit tests** using `vi.stubGlobal('fetch', ...)` — no real network, no in-process server:

- Active flag in snapshot → `isEnabled('key')` returns `true`
- Inactive flag in snapshot → `isEnabled('key')` returns `false`
- Key absent from snapshot → `isEnabled('unknown')` returns `false`
- `isEnabled()` before `connect()` → throws `ClientNotConnected`
- `connect()` receives non-200 → throws `ConnectFailed`
- `connect()` fetch throws (network error) → throws `ConnectFailed`
- `connect()` receives malformed JSON → throws (Effect Schema decode error)

### Acceptance criteria

- [ ] `packages/sdk-node` package exists with `tsconfig.json` extending `@repo/typescript-config/node.json`
- [ ] `SdkClient` class with `connect(): Promise<void>` and `isEnabled(key: string, context?: Record<string, string>): boolean`
- [ ] `createClient(args: CreateClientArgs): SdkClient` factory exported
- [ ] `ConnectFailed` and `ClientNotConnected` extend `Exception` (not `HttpException`)
- [ ] `connect()` validates the response with `FlagSnapshotResponseSchema` from `@repo/api`
- [ ] All seven unit test cases pass
- [ ] `pnpm build`, `pnpm lint`, `pnpm check-types`, and `pnpm test` pass with zero errors

### Blocked by

- Issue 1 — Rename `packages/api-schemas` → `packages/api` (SDK imports `@repo/api` for schema validation)
- Issue 2 — Split `Exception` / `HttpException` (SDK exceptions extend `Exception`)
