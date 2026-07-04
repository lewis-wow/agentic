# AGENTS.md — packages/sdk-node

## Purpose

Node.js SDK client for consuming the feature flag API. Authenticates via an API key (`<envSlug>_<id>.<secret>`, where `envSlug` is a cosmetic hint only), fetches the flag snapshot on `connect()`, and evaluates flags locally.

## Required Context Loading

- @.docs/typescript.md
- @.docs/effect.md

## Key Concepts

**Usage pattern:**

```ts
const client = new SdkClient({ apiUrl: '...', apiKey: 'env_...' });
await client.connect(); // fetches flag snapshot from apps/bff → apps/api
const enabled = client.isEnabled('my-flag', { userId: 'u_123' });
```

**Percentage rollout** — when `flag.type === FLAG_TYPE.PERCENTAGE_ROLLOUT`, `isEnabled` requires a `userId` in the context object and runs the bucketing algorithm (`bucket.ts`) to produce a deterministic 0–100 value. Returns `false` when `userId` is absent.

**Exception subclasses** live in `src/exceptions/` and extend `Exception` from `@repo/exception`.

## Rules

- `SdkClient` communicates with `apps/bff` (not `apps/api` directly). The API key is a BFF credential.
- Response parsing uses Effect `Schema.decodeUnknownSync` against schemas from `@repo/api`. Never parse response JSON manually.
- `connect()` must be called and awaited before any `isEnabled()` call. Calling `isEnabled()` before `connect()` throws `ClientNotConnected`.
- Do not add server-side features (Prisma, auth primitives) to this package. It is a pure client library.
- Exports are maintained via a barrelsby barrel at `src/index.ts`. After adding a new export, run `pnpm barrels` from the repo root.
