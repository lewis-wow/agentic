# Slice 12 — Docker Compose production stack

Architecture decisions agreed in grilling session.

- **Dedicated `migrator` service** runs `prisma migrate deploy` as a one-shot container (`restart: no`) before `api` or `dashboard` start. It uses its own Dockerfile built with `turbo prune @repo/prisma`.
- **`apps/api` Dockerfile** follows the same multi-stage pattern as `apps/bff`: turbo prune → frozen install → tsc build → `pnpm deploy --prod /standalone` → slim `node:20-alpine` runner.
- **`apps/dashboard` Dockerfile** uses Next.js `output: 'standalone'`. The runner stage copies `.next/standalone`, `.next/static`, and `public/`. `NEXT_PUBLIC_APP_URL` is injected as a Docker build arg (not dotenvx — it is baked at build time into the client bundle).
- **All three app images (api, dashboard, bff) use dotenvx** at runtime to decrypt their per-app `.env.production` files. Each service receives its own `DOTENV_PRIVATE_KEY` env var in Compose.
- **`migrator` receives `DATABASE_URL` as a plain Compose `environment:` entry** — no dotenvx needed for a one-shot migration container.
- **`api` healthcheck** uses a Node fetch one-liner: `node -e "fetch('http://localhost:3001/').then(r => process.exit(r.ok ? 0 : 1))"`. Available on any Node 20 runner image with no extra tooling.
- **Startup dependency chain:**
  ```
  postgres (healthy)
    └─ migrator (completed_successfully)
         └─ api (healthy)
              ├─ dashboard
              └─ bff
  ```

---

## Issue 1 — `apps/api` Dockerfile

### What to build

Add `apps/api/Dockerfile` using the same multi-stage pattern already used by `apps/bff/Dockerfile`. The only differences are the Turbo filter (`@repo/api-server` instead of `@repo/bff`) and the dist path (`apps/api/dist`).

Stages:

1. `base` — `node:20-alpine`, enable corepack for pnpm
2. `pruner` — install turbo globally, `turbo prune @repo/api-server --docker`
3. `installer` — copy pruned JSON + lockfile, `pnpm install --frozen-lockfile`
4. `builder` — copy full pruned source, `pnpm turbo build --filter=@repo/api-server`, then `pnpm --filter @repo/api-server deploy --prod --legacy /standalone`
5. `runner` — `node:20-alpine`, create non-root `nodejs` user, install `@dotenvx/dotenvx` globally, copy `/standalone` and `apps/api/dist`, run as `nodejs`, CMD: `dotenvx run --env-file=.env.production -- node dist/index.js`

### Acceptance criteria

- [ ] `apps/api/Dockerfile` exists and builds successfully from the monorepo root as context
- [ ] The runner image contains only production dependencies (no devDependencies, no source files)
- [ ] The container starts and serves `GET /` → `{ status: 'ok' }` when `DOTENV_PRIVATE_KEY` and a valid `.env.production` are present
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm check-types` all pass

## Issue 2 — `apps/dashboard` Dockerfile + standalone config

### What to build

Two changes are needed:

**`next.config.ts`:** add `output: 'standalone'` to the Next.js config so the build emits a self-contained `.next/standalone` directory.

**`apps/dashboard/Dockerfile`:** multi-stage build using `turbo prune @repo/dashboard`:

1. `base` — `node:20-alpine`, enable corepack
2. `pruner` — install turbo, `turbo prune @repo/dashboard --docker`
3. `installer` — copy pruned JSON + lockfile, `pnpm install --frozen-lockfile`
4. `builder` — copy full pruned source, inject `NEXT_PUBLIC_APP_URL` as a Docker `ARG` and set it as `ENV` before running `pnpm turbo build --filter=@repo/dashboard`, then `pnpm --filter @repo/dashboard deploy --prod --legacy /standalone`
5. `runner` — `node:20-alpine`, create non-root `nodejs` user, install `@dotenvx/dotenvx` globally, copy `.next/standalone`, `.next/static` (into `.next/static` inside standalone), and `public/`, run as `nodejs`, CMD: `dotenvx run --env-file=.env.production -- node server.js`

`NEXT_PUBLIC_APP_URL` must be declared as a Docker `ARG` in the builder stage and set via `ENV` before the build runs. It is a client-bundle constant, not a runtime secret — dotenvx at container startup is too late for it.

### Acceptance criteria

- [ ] `next.config.ts` includes `output: 'standalone'`
- [ ] `apps/dashboard/Dockerfile` exists and builds successfully from the monorepo root as context
- [ ] The standalone runner starts without full `node_modules` present
- [ ] `NEXT_PUBLIC_APP_URL` is correctly embedded in the built client bundle (verify via `grep` on `.next/standalone`)
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm check-types` all pass

## Issue 3 — Migrator Dockerfile

### What to build

Add a dedicated `apps/migrator/Dockerfile` (or `packages/prisma/Dockerfile`) that runs `prisma migrate deploy` as a one-shot command.

Stages:

1. `base` — `node:20-alpine`, enable corepack
2. `pruner` — install turbo, `turbo prune @repo/prisma --docker`
3. `installer` — copy pruned JSON + lockfile, `pnpm install --frozen-lockfile`
4. `runner` — copy full pruned source, run as non-root `nodejs` user, CMD: `pnpm --filter @repo/prisma db:migrate`

No dotenvx needed — `DATABASE_URL` is injected as a plain Compose environment variable. No build step (no TypeScript to compile).

### Acceptance criteria

- [ ] Migrator Dockerfile exists and builds successfully from the monorepo root as context
- [ ] The container runs `prisma migrate deploy` against a live database and exits 0 on success, non-zero on failure
- [ ] The image does not contain application source beyond `packages/prisma`
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm check-types` all pass

## Issue 4 — Production `docker-compose.yml`

### What to build

Replace the existing `docker-compose.yml` with a production-ready version wiring all five services together.

**Services and their dependencies:**

- `postgres` — `postgres:16-alpine`, healthcheck via `pg_isready`, named volume `postgres_data`
- `migrator` — built from the migrator Dockerfile, `restart: no`, `depends_on: postgres (service_healthy)`, receives `DATABASE_URL` as a plain env var
- `api` — built from `apps/api/Dockerfile`, `depends_on: migrator (service_completed_successfully)`, receives `DOTENV_PRIVATE_KEY` as env var, healthcheck: `node -e "fetch('http://localhost:3001/').then(r => process.exit(r.ok ? 0 : 1))"`
- `dashboard` — built from `apps/dashboard/Dockerfile`, `depends_on: api (service_healthy)`, receives `DOTENV_PRIVATE_KEY` and build arg `NEXT_PUBLIC_APP_URL`
- `bff` — built from `apps/bff/Dockerfile`, `depends_on: api (service_healthy)`, receives `DOTENV_PRIVATE_KEY`

Each app service has its own `DOTENV_PRIVATE_KEY` passed as a distinct Compose env var name (e.g. `DOTENV_PRIVATE_KEY_API`, `DOTENV_PRIVATE_KEY_DASHBOARD`, `DOTENV_PRIVATE_KEY_BFF`) mapped to `DOTENV_PRIVATE_KEY` inside the container.

### Acceptance criteria

- [ ] `docker compose up` starts all five services in the correct order without manual intervention
- [ ] Migrations run automatically before `api` accepts traffic
- [ ] `api` must pass its healthcheck before `dashboard` or `bff` begin starting
- [ ] `migrator` exits 0 and does not restart after a successful migration run
- [ ] Each app container decrypts its own `.env.production` at startup using its own `DOTENV_PRIVATE_KEY`
- [ ] `NEXT_PUBLIC_APP_URL` is passed as a build arg to the `dashboard` build stage
- [ ] Blocked by Issues 1, 2, and 3
