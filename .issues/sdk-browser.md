# Slice 11 — Browser SDK

Architecture decisions agreed in grilling session.

- **`eventsource` npm package is used in both Node.js and browser** — no EventSource DI needed; `sdk-core` imports it directly. It is W3C-compatible, works in Chrome 71+, Safari 11.3+, Firefox 65+, Edge 79+, and Node.js ≥ 20.
- **`sdk-core` holds the entire implementation.** `sdk-node` and `sdk-browser` are thin re-export + tsup-build wrappers with no diverging logic.
- **`isEnabled()` is async on both SDKs.** It uses `globalThis.crypto.subtle` (WebCrypto SHA-256) for percentage-rollout bucketing, which is async-only. No API divergence between browser and Node.
- **`connect()` resolves after the first `snapshot` SSE event is received and applied.** It opens an `EventSource` on `GET /v1/flags/stream` and races against `connectTimeout` (default 10 000 ms). HTTP-level errors are surfaced via `event.code` (extended property of the `eventsource` package) — no pre-flight fetch needed.
- **`SdkClient extends EventTarget`.** Live flag updates after `connect()` are signalled by a single `'change'` `CustomEvent` with `detail: { key: string }`.
- **`disconnect()` closes the `EventSource`**, clears the flag map, and resets to the pre-connect state. `isEnabled()` throws `ClientNotConnected` again after disconnect.
- **Server must be fixed** before the SSE client can handle `flag_unarchived` correctly: that event's payload currently only carries `key`; it must include the full flag state.
- **Both SDKs are built with tsup**, producing tree-shakeable ESM bundles with declaration files.

---

## Issue 1 — Server fix: include full flag state in `flag_unarchived` payload

### What to build

The `flag_unarchived` SSE event emitted by `apps/api` currently only includes `{ key: string }` in its payload. An SDK client that receives this event cannot restore the flag to its in-memory map — it doesn't know the flag's `enabled`, `type`, `rollout`, or `rules` values.

Change `emitFlagEvent` (or whichever call site emits `flag_unarchived`) so the payload for that event type includes the full flag state, matching the shape already used by `flag_created` and `flag_updated`:

```ts
type FlagStreamEventPayload = {
  key: string;
  enabled?: boolean;
  type?: string;
  rollout?: number;
  rules?: unknown[];
};
```

Update the corresponding call site in `apps/api` that emits `flag_unarchived` to fetch and include the flag's current state before emitting. Update or add integration tests to assert that the SSE stream delivers a full-state payload for `flag_unarchived`.

### Acceptance criteria

- [ ] `flag_unarchived` SSE event payload includes `key`, `enabled`, `type`, `rollout`, and `rules`
- [ ] The call site that emits `flag_unarchived` reads the current flag state from the database before emitting
- [ ] Integration test asserts the full payload shape for `flag_unarchived`
- [ ] `flag_created` and `flag_updated` payloads are unchanged
- [ ] `pnpm test`, `pnpm lint`, and `pnpm check-types` pass with zero errors

### Blocked by

None — can start immediately.

---

## Issue 2 — Prefactor: extract `packages/sdk-core` from `packages/sdk-node`

### What to build

The current `packages/sdk-node` holds all SDK logic. Extract the shared implementation into a new `packages/sdk-core` workspace package so that `sdk-node` and the forthcoming `sdk-browser` can both depend on it without duplicating code.

**What moves into `sdk-core`:**

- `SdkClient` class (renamed to extend `EventTarget` — see shape below)
- `bucket()` function (rewritten to use `globalThis.crypto.subtle` SHA-256 — async)
- `ClientNotConnected` and `ConnectFailed` exception classes
- All flag-evaluation logic (`evaluateRule`, the flag map, `isEnabled`)
- Effect Schema snapshot validation
- Dependency on `eventsource` npm package (replacing the one-shot `fetch`)

**`SdkClient` public surface after extraction:**

```ts
type SdkClientOptions = {
  apiUrl: string;
  apiKey: string;
  connectTimeout?: number; // ms, default 10_000
};

class SdkClient extends EventTarget {
  constructor(options: SdkClientOptions);
  connect(): Promise<void>;
  disconnect(): void;
  isEnabled(key: string, context?: Record<string, string>): Promise<boolean>;
}

// 'change' CustomEvent detail shape
type FlagChangeDetail = { key: string };
```

`connect()` opens an `EventSource` on `${apiUrl}/v1/flags/stream` with `Authorization: Bearer <apiKey>`. It resolves when the first `snapshot` SSE event is received and applied to the flag map. It rejects with `ConnectFailed` if `event.code` is set on the error handler (HTTP error) or if `connectTimeout` elapses before the snapshot arrives. After `connect()` resolves, the `EventSource` stays open and patches the flag map on each subsequent SSE event (`flag_created`, `flag_updated`, `flag_archived`, `flag_unarchived`, `flag_deleted`), dispatching a `'change'` `CustomEvent` with `detail: { key }` for each mutation.

`disconnect()` closes the `EventSource` and clears the flag map. After disconnect, `isEnabled()` throws `ClientNotConnected`.

`isEnabled()` is async because the WebCrypto SHA-256 used in `bucket()` is Promise-based.

**`packages/sdk-node` after extraction:**

Becomes a thin wrapper — re-exports `createClient`, `SdkClient`, `SdkClientOptions`, `ConnectFailed`, `ClientNotConnected` from `@repo/sdk-core`. Its `package.json` adds `@repo/sdk-core` as a dependency and removes the implementation files.

All existing `sdk-node` tests must be updated for the new async `isEnabled()` signature and SSE-based `connect()` (stub `EventSource` rather than `fetch`).

### Acceptance criteria

- [ ] `packages/sdk-core` workspace package exists with its own `package.json`, `tsconfig.json`, and `eslint.config.mjs`
- [ ] `SdkClient extends EventTarget` with `connect()`, `disconnect()`, and `async isEnabled()`
- [ ] `bucket()` uses `globalThis.crypto.subtle` SHA-256 (async); `isEnabled()` awaits it
- [ ] `connect()` opens `EventSource` on `/v1/flags/stream`; resolves after first `snapshot` event
- [ ] `connect()` rejects with `ConnectFailed` on HTTP error (`event.code`) or timeout
- [ ] `disconnect()` closes `EventSource`; subsequent `isEnabled()` throws `ClientNotConnected`
- [ ] `'change'` `CustomEvent` is dispatched with `detail: { key }` on every flag map mutation
- [ ] `ConnectFailed` and `ClientNotConnected` live in `sdk-core` and extend `Exception`
- [ ] `packages/sdk-node` re-exports everything from `sdk-core` with no logic of its own
- [ ] `pnpm build`, `pnpm lint`, `pnpm check-types`, and `pnpm test` pass with zero errors

### Blocked by

- Issue 1 — `flag_unarchived` must carry full state before the SSE client can handle it correctly

---

## Issue 3 — Feature: `packages/sdk-browser` and tsup builds for both SDKs

### What to build

Add `packages/sdk-browser` and configure **tsup** builds for both `sdk-browser` and `sdk-node` so each produces a tree-shakeable ESM bundle with declaration files.

**`packages/sdk-browser`**

A thin wrapper over `sdk-core` — no logic of its own. Its `package.json` lists `@repo/sdk-core` as a dependency. Its `src/index.ts` re-exports everything from `sdk-core`:

```ts
export { createClient, SdkClient } from '@repo/sdk-core';
export type { SdkClientOptions, FlagChangeDetail } from '@repo/sdk-core';
export { ConnectFailed, ClientNotConnected } from '@repo/sdk-core';
```

**tsup config for `sdk-browser`** (`tsup.config.ts`):

- Entry: `src/index.ts`
- Format: `esm`
- `dts: true`
- `platform: 'browser'`
- `minify: true`
- `treeshake: true`

**tsup config for `sdk-node`** (`tsup.config.ts`):

- Entry: `src/index.ts`
- Format: `esm`
- `dts: true`
- `platform: 'node'`
- `minify: false`

Both packages:

- Add a `build` script: `tsup`
- Update `exports` in `package.json` to point at the tsup output (`./dist/index.js` for runtime, `./dist/index.d.ts` for types)
- Add `dist/` to `.gitignore`
- Keep `"private": true` (publishing is out of scope for this slice)

### Acceptance criteria

- [ ] `packages/sdk-browser` package exists and re-exports the full public surface of `sdk-core`
- [ ] `pnpm build` in `sdk-browser` produces `dist/index.js` (ESM, minified) and `dist/index.d.ts`
- [ ] `pnpm build` in `sdk-node` produces `dist/index.js` (ESM) and `dist/index.d.ts`
- [ ] `package.json` `exports` in both packages point at `dist/`
- [ ] Turborepo `build` pipeline produces both packages without error
- [ ] `pnpm build`, `pnpm lint`, and `pnpm check-types` pass with zero errors across the monorepo

### Blocked by

- Issue 2 — `packages/sdk-core` must exist before `sdk-browser` can depend on it
