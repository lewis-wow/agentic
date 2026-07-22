# AGENTS.md

## Core Rules

- Package manager: pnpm
- Node.js version: stored in @.nvmrc using NVM
- Modules: ESM
- Always scope non-global .env into particular app as .env.production for production or .env.development for development
- node_modules are stored in root node_modules/ folder
- All GitHub activity performed by Claude Code must be prefixed with `CLAUDE: ` — this includes issue titles, issue comments, close descriptions, PR titles/descriptions, and any other content posted to GitHub. The same `CLAUDE: ` prefix applies to git commit messages.
- **No "Source Layout" sections in any `AGENTS.md`.** A file tree with per-file/per-directory descriptions goes stale the moment a file is added, renamed, or moved, and duplicates what belongs next to the code. Document a file's purpose as a short comment at the top of that file (or, for a directory, its barrel/index file) instead.
- **[`CONTEXT.md`](CONTEXT.md) (root) is the living glossary and domain model for this project.** It defines precise domain terms — services, entities, auth/role vocabulary, flag-evaluation concepts, contract/schema terminology — each cross-linked to the ADR or spec doc that's the source of truth for it, so AI coding agents don't drift on project jargon. Read it before working on unfamiliar domain code. Whenever a term is coined, renamed, or redefined, update its entry there in the same change.
- **Never write into the `skills/` folder under `.agents/` (or its `.claude/skills` symlinks).** Those skills are installed from an external source — hand edits get silently lost on the next install/sync and don't reflect anywhere the source manages them. If a skill's behavior needs to change, raise it with the user instead of editing the file directly.

## Required Context Loading

You have access to specific local documentation files for this project. Before writing, refactoring, or reviewing any code, you must use your file-reading tool to read the relevant documentation file from the list below based on the technology you are working with:

- For TypeScript use: [docs/standards/typescript.md](docs/standards/typescript.md) (Strict TypeScript development standards, JavaScript is prohibited)
- For React use: [docs/standards/react.md](docs/standards/react.md) (React architectural patterns and state management)
- For Turborepo use: [docs/standards/turborepo.md](docs/standards/turborepo.md) (Turborepo workspace management and build orchestration)
- For Dotenvx use: [docs/standards/dotenvx.md](docs/standards/dotenvx.md) (Dotenvx multi-environment configuration and vault encryption)
- For Hono use: [docs/standards/hono.md](docs/standards/hono.md) (Hono HTTP routing, middleware, and backend context)
- For Effect use: [docs/standards/effect.md](docs/standards/effect.md) (Effect schemas, data parsing, and runtime validation)
- For Shadcn UI use: [docs/standards/shadcnui.md](docs/standards/shadcnui.md) (Shadcn UI design system and primitive configurations)
- For Prisma use: [docs/standards/prisma.md](docs/standards/prisma.md) (Prisma schema declarations and database client)
- For TanStack Query use: [docs/standards/tanstack-query.md](docs/standards/tanstack-query.md) (Data fetching and mutation patterns in the dashboard)

Strictly follow the guidelines found inside these files for every task.

## Specification

Repo-wide conventions live in `docs/specification/`. Read the relevant file before touching the area it covers:

- [Environment API Keys](docs/specification/api-keys.md)
- [Testing Convention](docs/specification/testing.md)
- [Environment Variables](docs/specification/environment-variables.md)
- [Barrel Files](docs/specification/barrel-files.md)
- [Effect Schema for Requests and Responses](docs/specification/effect-schema.md)
- [Schema File Organization: `<name>.ts` vs `<name>.dto.ts`](docs/specification/schema-file-organization.md)
- [OpenAPI Generation](docs/specification/openapi.md)
- [Forms](docs/specification/forms.md)
- [App-Scoped Packages for Domain Schemas](docs/specification/app-scoped-packages.md)
- [Enums and Constants](docs/specification/enums-and-constants.md)
- [Error Handling with Exception Classes](docs/specification/error-handling.md)
- [Skill Extensions](docs/specification/skill-extensions.md)

Decision history lives in [`docs/adr/`](docs/adr/); domain vocabulary and architecture live in [CONTEXT.md](CONTEXT.md).

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

## Issue Resolution Workflow

- A reference like `#<int>` (e.g. `#5`) means issue number `<int>` on GitHub in this repo.
- When a referenced issue has subissues, use the `gh` CLI to look up its subissues before starting work (e.g. `gh issue view <int> --json subIssues`, falling back to `gh api` if the field isn't available in the installed `gh` version).
- Every issue that gets solved — parent or subissue — must have its own dedicated commit; do not bundle fixes for multiple issues into one commit.
- For a parent issue with subissues, solve and commit each subissue individually first, one commit per subissue immediately after it's solved.
- Every commit produced by this workflow must use the `CLAUDE: ` prefix per the GitHub activity rule above.
- After an issue's commit exists, push it to the remote, then post a `CLAUDE: ` comment on that issue linking to the commit (`https://github.com/<owner>/<repo>/commit/<sha>`) — do not close the issue. Once every subissue of a parent is done this way, post the same kind of comment on the parent linking to all of its subissues' commits.

## Commands

```bash
# Development
pnpm dev                    # Start all apps + the Trusted Proxy Auth stand-in (see docs/adr/0014-trusted-proxy-authentication.md) —
                             # visit http://localhost:4000, not :3000 directly, to get an identity
pnpm dev:proxy              # Just the proxy stand-in on its own, e.g. if the apps are already running elsewhere
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

See [CONTEXT.md](CONTEXT.md) for the full architecture overview and domain glossary. In short: this is a **Turborepo monorepo** (`apps/*` — runnable services; `packages/*` — shared internal tooling, not published), and `apps/api` is the only service that reads or writes data. Each layer has its own `AGENTS.md` with layer-specific rules — read the relevant one before working in that layer.
