# App-Scoped Packages for Domain Schemas

Each application that exposes a contract (HTTP responses, request bodies, events) owns a sibling `packages/<app-name>` package for the schemas and other artefacts that belong to that domain:

| App        | Sibling package | What goes there                                                                                 |
| ---------- | --------------- | ----------------------------------------------------------------------------------------------- |
| `apps/api` | `packages/api`  | Request/response schemas for every `apps/api` endpoint, shared types derived from those schemas |
| `apps/bff` | `packages/bff`  | Credential-exchange primitives used by both BFF layers                                          |

**Rule:** if a schema or type is only consumed by one application's domain, it lives in that application's sibling package — not in a generic shared package such as `packages/types` or a hypothetical `packages/schemas`.

Generic shared packages (`packages/types`, `packages/auth`, `packages/prisma`, …) are reserved for cross-cutting infrastructure concerns that are genuinely independent of any single application's domain. Do not add domain schemas there.
