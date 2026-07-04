# AGENTS.md

## Core Rules

- Package manager: pnpm
- Node.js version: stored in @.nvmrc using NVM
- Modules: ESM
- Always scope non-global .env into particular app as .env.production for production or .env.development for development
- node_modules are stored in root node_modules/ folder
- All GitHub activity performed by Claude Code must be prefixed with `CLAUDE: ` — this includes issue titles, issue comments, close descriptions, PR titles/descriptions, and any other content posted to GitHub. The same `CLAUDE: ` prefix applies to git commit messages.

## Required Context Loading

You have access to specific local documentation files for this project. Before writing, refactoring, or reviewing any code, you must use your file-reading tool to read the relevant documentation file from the list below based on the technology you are working with:

- For TypeScript use: @docs/standards/typescript.md (Strict TypeScript development standards, JavaScript is prohibited)
- For React use: @docs/standards/react.md (React architectural patterns and state management)
- For Turborepo use: @docs/standards/turborepo.md (Turborepo workspace management and build orchestration)
- For Dotenvx use: @docs/standards/dotenvx.md (Dotenvx multi-environment configuration and vault encryption)
- For Hono use: @docs/standards/hono.md (Hono HTTP routing, middleware, and backend context)
- For Effect use: @docs/standards/effect.md (Effect schemas, data parsing, and runtime validation)
- For Shadcn UI use: @docs/standards/shadcnui.md (Shadcn UI design system and primitive configurations)
- For Prisma use: @docs/standards/prisma.md (Prisma schema declarations and database client)
- For TanStack Query use: @docs/standards/tanstack-query.md (Data fetching and mutation patterns in the dashboard)

Strictly follow the guidelines found inside these files for every task.

## Specification

Repo-wide conventions live in `docs/specification/`. Read the relevant file before touching the area it covers:

- [Architecture & Data Flow](docs/specification/architecture.md)
- [Testing Convention](docs/specification/testing.md)
- [Environment Variables](docs/specification/environment-variables.md)
- [Barrel Files](docs/specification/barrel-files.md)
- [Effect Schema for Requests and Responses](docs/specification/effect-schema.md)
- [Forms](docs/specification/forms.md)
- [App-Scoped Packages for Domain Schemas](docs/specification/app-scoped-packages.md)
- [Enums and Constants](docs/specification/enums-and-constants.md)
- [Error Handling with Exception Classes](docs/specification/error-handling.md)

Decision history lives in [`docs/adr/`](docs/adr/); domain vocabulary lives in [`CONTEXT.md`](CONTEXT.md).

## Post-Modification Checklist

After **every** code change — no exceptions — run all of the following and fix any failures before considering the task done:

```bash
pnpm format        # auto-fix formatting
pnpm format:check  # must pass with zero errors
pnpm lint          # must pass with zero errors
pnpm check-types   # must pass with zero errors
pnpm test          # all unit + integration tests must pass
pnpm build         # build all applications
```

Do not report a task as complete if any of these commands exit with a non-zero status. Fix the root cause; do not suppress errors with ignore comments or skip flags.

## Commands

```bash
# Development
pnpm dev                    # Start all apps in watch mode
pnpm dev:proxy              # Stand-in reverse proxy for Trusted Proxy Auth (see docs/adr/0014-trusted-proxy-authentication.md) —
                             # visit http://localhost:4000 instead of :3000 directly
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

**`apps/api` is the only service that reads or writes data.** Each layer has its own `AGENTS.md` with layer-specific rules — read the relevant one before working in that layer.
