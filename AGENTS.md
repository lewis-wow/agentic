# AGENTS.md

## Core Rules

- Package manager: pnpm
- Node.js version: stored in @.nvmrc using NVM
- Modules: ESM
- Always scope non-global .env into particular app as .env.production for production or .env.development for development
- node_modules are stored in root node_modules/ folder

## Required Context Loading

You have access to specific local documentation files for this project. Before writing, refactoring, or reviewing any code, you must use your file-reading tool to read the relevant documentation file from the list below based on the technology you are working with:

- For TypeScript use: @.docs/typescript.md (Strict TypeScript development standards, JavaScript is prohibited)
- For React use: @.docs/react.md (React architectural patterns and state management)
- For Turborepo use: @.docs/turborepo.md (Turborepo workspace management and build orchestration)
- For Dotenvx use: @.docs/dotenvx.md (Dotenvx multi-environment configuration and vault encryption)
- For Hono use: @.docs/hono.md (Hono HTTP routing, middleware, and backend context)
- For Effect use: @.docs/effect.md (Effect schemas, data parsing, and runtime validation)
- For Shadcn UI use: @.docs/shadcnui.md (Shadcn UI design system and primitive configurations)
- For Prisma use: @.docs/prisma.md (Prisma schema declarations and database client)
- For TanStack Query use: @.docs/tanstack-query.md (Data fetching and mutation patterns in the dashboard)

Strictly follow the guidelines found inside these files for every task.

## Post-Modification Checklist

After **every** code change — no exceptions — run all of the following and fix any failures before considering the task done:

```bash
pnpm format        # auto-fix formatting
pnpm format:check  # must pass with zero errors
pnpm lint          # must pass with zero errors
pnpm check-types   # must pass with zero errors
pnpm test          # all unit + integration tests must pass
```

Do not report a task as complete if any of these commands exit with a non-zero status. Fix the root cause; do not suppress errors with ignore comments or skip flags.

## Commands

```bash
# Development
pnpm dev                    # Start all apps in watch mode
pnpm build                  # Build all packages/apps (Turborepo)
pnpm lint                   # Lint all packages/apps
pnpm check-types            # TypeScript type-check all packages/apps
pnpm format                 # Format with Prettier (writes)
pnpm format:check           # Format check only

# Tests (run from repo root)
pnpm test                   # Run all tests (unit + integration)
pnpm test:unit              # Run unit tests only
pnpm test:integration       # Run integration tests only
pnpm test:coverage          # Run all tests with coverage
pnpm test:ui                # Open Vitest UI

# Barrel index generation
pnpm barrels                # Regenerate all index.ts barrel files
```

To run tests for a single app, `cd` into the app directory and run `vitest run` directly with the appropriate config, or use Turbo filters: `turbo run build --filter=@repo/bff`.

## Architecture

This is a **Turborepo monorepo** with two workspace groups:

- `apps/*` — runnable services
- `packages/*` — shared internal tooling (not published)

### Data Flow — API is the Single Source of Truth

**`apps/api` is the only service that reads or writes data.** The dashboard never accesses Prisma directly and never uses Next.js server actions for data operations. All reads and writes go through `apps/api` via a credential-exchange layer.

There are two credential paths, both implemented using the shared `@repo/bff` package:

```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard browser (React + TanStack Query)                  │
│  fetch('/api/...')  — same-origin Next.js API routes         │
└─────────────────────────┬───────────────────────────────────┘
                          │  session cookie
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Next.js API Route Handlers  (apps/dashboard/src/app/api/)   │
│  uses @repo/bff: session cookie → RS256 JWT                  │
│  forwards request to apps/api with Authorization header      │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┴──────────────┐
          │                              │
          ▼                              ▼
┌──────────────────────┐    ┌────────────────────────────────┐
│  apps/api (Hono)     │    │  apps/bff (Hono)               │
│  verify RS256 JWT    │◄───│  uses @repo/bff:               │
│  all Prisma + logic  │    │  API key → RS256 JWT           │
└──────────────────────┘    │  forwards to apps/api          │
                            └────────────────────────────────┘
                                         ▲
                                         │  env_<id>.<secret>
                            ┌────────────┴───────────────────┐
                            │  External SDK clients           │
                            └────────────────────────────────┘
```

**Role of each layer:**

- **`apps/api`** — the single source of truth. Owns every Prisma query, all business logic, and all validation. Routes are protected by JWT verification; the service has no knowledge of sessions or API keys.
- **`apps/dashboard` Next.js API routes** — internal BFF for the browser UI. A route handler reads the Better Auth session cookie, uses `@repo/bff` to validate it and mint a short-lived RS256 JWT, then forwards the request to `apps/api`. No business logic lives here.
- **`apps/bff`** — external BFF for SDK clients. Parses `env_<apiKeyId>.<secret>` Bearer tokens, uses `@repo/bff` to verify and mint an RS256 JWT, then forwards to `apps/api`. No business logic lives here.
- **`packages/bff`** — shared credential-exchange primitives used by both BFF layers: session token extraction and validation, JWT minting, and `forwardWithJwt` request forwarding. Framework-agnostic (works in Hono middleware and Next.js Route Handlers alike).

**Dashboard data rules:**

- Client components use TanStack Query (`useQuery` / `useMutation`) to call the Next.js API routes at `/api/...`.
- Next.js API routes do nothing except authenticate and proxy — they contain no business logic.
- **No Next.js server actions for data.** Server actions were used in Slices 1–3 and must be migrated. New code must never introduce server actions for data fetching or mutation.
- **No direct Prisma calls from the dashboard.** All reads and writes go through `apps/api`.

### Apps

**`apps/bff`** — External BFF for SDK clients. Built with [Hono](https://hono.dev) on `@hono/node-server`. Runs via `tsx` in dev. Validates `env_<apiKeyId>.<secret>` Bearer tokens, mints RS256 JWTs via `@repo/bff`, and reverse-proxies to `apps/api`. Environment variables validated at startup via Effect `Schema` (see `src/env.ts`). Build output goes to `dist/`.

### Shared Packages

| Package                      | Purpose                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `packages/bff`               | Credential-exchange primitives: session validation, JWT minting, `forwardWithJwt` forwarding     |
| `packages/auth`              | JWT sign/verify, RS256 key helpers, API key generate/verify, role constants, shared JWT claims   |
| `packages/prisma`            | Prisma schema, generated client, re-exported as `@repo/prisma`                                   |
| `packages/typescript-config` | Shared `tsconfig` presets (`base.json`, `node.json`)                                             |
| `packages/eslint-config`     | Shared ESLint flat-config presets (`base.js`, `node.js`)                                         |
| `packages/vitest-config`     | Shared Vitest config factories (`unit.ts`, `integration.ts`, `consts.ts`)                        |

### Testing Convention

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

### Environment Variables

Dotenvx is used for environment management. Variables are layered:

- Root `.env.{development,production,test}` — shared/global vars
- `apps/<name>/.env.{development,production,test}` — app-specific vars (takes precedence)

Env schemas are validated at runtime using Effect `Schema.Struct` in each app's `src/env.ts`. Add new env vars to both the `.env.*` files and the corresponding `Schema.Struct`.

### Barrel Files

Public module surfaces are maintained as `index.ts` barrel files generated by **barrelsby** (config: `.barrelsby.json`). After adding or removing exports, run `pnpm barrels` to regenerate. Barrel files themselves are excluded from coverage reports.
