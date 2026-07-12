# Architecture

This platform is a self-hosted feature flag service: a dashboard for managing flags/environments/projects, an API that serves flag evaluations to SDKs, and a BFF that exchanges credentials (proxy-asserted user identity, or an environment API key) for short-lived JWTs.

This is a **Turborepo monorepo** with two workspace groups:

- `apps/*` — runnable services
- `packages/*` — shared internal tooling (not published)

## Domain Language

See [Environment API Keys](./api-keys.md) for the `Environment API Key` and `Key Prefix` vocabulary.

## Data Flow — API is the Single Source of Truth

**`apps/api` is the only service that reads or writes data.** All reads and writes from every other layer go through `apps/api` via a credential-exchange layer. See [ADR-0010](../adr/0010-api-is-single-source-of-truth.md) for why.

Each layer has its own `AGENTS.md` with layer-specific rules. Read the relevant one before working in that layer.

**Within the `apps/api` / `packages/api` pair, the split is by framework dependency, not by "app vs package."** `packages/api` is framework-agnostic — schemas, exceptions, business-logic services, validation helpers, none of it importing Hono — and `apps/api` is Hono-only: routes, middleware, the server entrypoint. See [App-Scoped Packages](./app-scoped-packages.md) and `packages/api/AGENTS.md`.

## Startup Logging

Every runnable app in `apps/*` must print the URL it's listening on to the console once it starts. For Hono services this means passing a `listeningListener` callback to `serve(...)` (see `apps/api/src/index.ts` and `apps/bff/src/index.ts`); frameworks that already print their own URL on startup (e.g. Next.js's `next dev`/`next start`) satisfy this automatically.
