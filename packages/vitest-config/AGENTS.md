# AGENTS.md — packages/vitest-config

## Purpose

Shared Vitest config factories used by every app's `__tests__/vitest.unit.config.ts` and `__tests__/vitest.integration.config.ts`.

## Required Context Loading

- @.docs/typescript.md

## Usage

Each app extends the base config with `mergeConfig` and sets `test.root` to its own directory:

```ts
import { unitConfig } from '@repo/vitest-config';
import path from 'node:path';
import { mergeConfig } from 'vitest/config';

export default mergeConfig(unitConfig, {
  test: { name: 'myapp:unit', root: path.resolve(import.meta.dirname, '..') },
});
```

Setting `test.root` is **required** — without it Vitest resolves include patterns relative to the workspace root, which causes tests from other apps to be picked up.

## Rules

- Do not add app-specific settings here. Override only in the consuming app's config file.
- `integrationConfig` always has `fileParallelism: false`. Never override this to `true` — integration tests share external resources (DB, ports) and must run serially.
- Barrel files (`**/index.{ts,tsx}`) are always excluded from coverage reports via `COVERAGE_EXCLUDE`. Do not add them to coverage.
