# Testing Convention

Each app owns a `__tests__/` directory with two config files:

```text
__tests__/
  vitest.unit.config.ts         # imports unitConfig from @repo/vitest-config
  vitest.integration.config.ts  # imports integrationConfig from @repo/vitest-config
  unit/                         # unit test files: *.test.ts / *.spec.ts
  integration/                  # integration test files: *.test.ts / *.spec.ts
```

Root-level `vitest.config.ts` discovers all `__tests__/vitest.*.config.ts` files across the repo. Integration tests run with `fileParallelism: false`.

**Critical**: each `vitest.*.config.ts` in an app's `__tests__/` must set `test.root` to the app directory or vitest resolves include patterns relative to the workspace root:

```ts
import path from 'node:path';

export default mergeConfig(unitConfig, {
  test: { name: 'myapp:unit', root: path.resolve(import.meta.dirname, '..') },
});
```

## Real Database, No Mocks

**Never mock `@repo/prisma`, or any other real dependency, in unit or integration tests.** `vi.mock(...)` on the database client is not permitted anywhere in the test suite. Both tiers run against the real local test Postgres database (`DATABASE_URL` in each app's `.env.test`, e.g. `featureflags_test`) — the split between "unit" and "integration" is about **what is being driven**, not real vs. fake dependencies:

- **Unit tests** call a service's methods directly — e.g. `new FlagService({ prisma }).updateEnvironment(args)` — with no HTTP layer, no Hono app, no middleware involved. The service is constructed with the real `prisma` client pointed at the test database.
- **Integration tests** drive the full HTTP path — Hono app, JWT/auth middleware, routing, and the service underneath — via requests against the app instance, also against the real test database.

If a service needs a dependency faked for a specific edge case that's impractical to reproduce in Postgres (e.g. a connection failure), that's the one case for a hand-written fake passed through the service's `Options` constructor param — not a `vi.mock` of the real module.
