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
