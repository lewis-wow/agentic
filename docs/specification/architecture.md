# Architecture

This is a **Turborepo monorepo** with two workspace groups:

- `apps/*` — runnable services
- `packages/*` — shared internal tooling (not published)

## Data Flow — API is the Single Source of Truth

**`apps/api` is the only service that reads or writes data.** All reads and writes from every other layer go through `apps/api` via a credential-exchange layer. See [ADR-0010](../adr/0010-api-is-single-source-of-truth.md) for why.

Each layer has its own `AGENTS.md` with layer-specific rules. Read the relevant one before working in that layer.
