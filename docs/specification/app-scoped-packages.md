# App-Scoped Packages for Domain Schemas

Each application that exposes a contract (HTTP responses, request bodies, events) owns a sibling `packages/<app-name>` package for the schemas and other artefacts that belong to that domain:

| App        | Sibling package | What goes there                                                                                                                                                                                                                                                                                       |
| ---------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api` | `packages/api`  | Request/response schemas for every `apps/api` endpoint, shared types derived from those schemas, **and** everything else about `apps/api`'s behavior that has no Hono dependency: exceptions, business-logic services, framework-agnostic validation helpers (see below and `packages/api/AGENTS.md`) |
| `apps/bff` | `packages/bff`  | Credential-exchange primitives used by both BFF layers                                                                                                                                                                                                                                                |

**Rule:** if a schema or type is only consumed by one application's domain, it lives in that application's sibling package — not in a generic shared package such as `packages/types` or a hypothetical `packages/schemas`.

Generic shared packages (`packages/types`, `packages/auth`, `packages/prisma`, …) are reserved for cross-cutting infrastructure concerns that are genuinely independent of any single application's domain. Do not add domain schemas there.

## `packages/api` is framework-agnostic; `apps/api` is the Hono transport

`packages/api` isn't only a schema package for `apps/api` — it's the framework-agnostic core. Anything that doesn't need Hono (`hono`, `Context`, `Handler`) belongs there, exposed through its own subpath export, not inside `apps/api`:

- `@repo/api` (root) — request/response/param/query schemas.
- `@repo/api/exceptions` — `Exception` subclasses.
- `@repo/api/services` — business-logic service classes (constructor-DI, no Hono, no singleton imports).
- `@repo/api/validation` — a `decodeOrThrow(schema)` helper for validating input outside an HTTP request cycle.

`apps/api` keeps only what's inherently tied to Hono: route handlers, the JWT middleware, and the Hono-specific half of request validation (`src/validation.ts`, which wires a schema to `@hono/standard-validator`'s `sValidator`). Runtime infrastructure that doesn't depend on Hono — including the SSE event bus (`@repo/api/events`'s `flagEmitter` singleton and `FlagEventService`) — lives in `packages/api` instead; see [ADR-0021](../adr/0021-flag-event-bus-lives-in-packages-api.md) for why that's true even for a stateful singleton. A service that needs infrastructure genuinely specific to `apps/api`'s own runtime takes it through its `Options` constructor param, typed as a local structural interface — never by importing the concrete `apps/api` module, which would invert the dependency direction. See `packages/api/AGENTS.md` and `docs/specification/effect-schema.md`.
