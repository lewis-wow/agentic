# OpenAPI Generation

`packages/api/src/openapi.ts` generates an OpenAPI 3.1 document directly from the Effect Schemas already defined in `packages/api` — there is no separate OpenAPI annotation layer, no `@hono/zod-openapi`-style route builder, and no hand-maintained YAML/JSON spec file to keep in sync.

## Framework-agnostic by design

`openapi.ts` imports only from `effect` (`Schema`, `JSONSchema`) and sibling schema files — never from `hono` or any app package. `apps/api` depends on it, not the other way around. This means:

- The generator can be unit tested, reused, or published independently of Hono.
- Any request/response body already expressed as a `Schema.Struct` can be documented by referencing it once in the route registry — no duplicate type-level annotation.

## The route registry

Because an Effect Schema only describes a payload shape, not an HTTP method/path, `openapi.ts` keeps a small hand-authored `ROUTES` array mapping `{ method, path, tag, summary }` to the request/response schema(s) that already exist for that endpoint:

```ts
{
  method: 'get',
  path: '/projects/{projectId}/flags',
  tag: 'Flags',
  summary: 'List flags for an environment',
  response: { schema: FlagListPageSchema },
},
```

**Only endpoints already backed by a `Schema.Struct` are listed.** Endpoints that still hand-parse request bodies or return ad hoc JSON (most single-resource GET/PATCH/DELETE handlers today) are intentionally absent rather than documented with a fabricated schema — add the real schema first (see [Effect Schema for Requests and Responses](./effect-schema.md)), then add its entry to `ROUTES`.

`generateOpenApiDocument()` walks `ROUTES`, converts each schema to JSON Schema via `JSONSchema.make`, and assembles the `paths`/`components` object. Path parameters (`{projectId}`) are extracted from the path string automatically.

## Serving it

`apps/api/src/index.ts` wires two plain Hono routes:

- `GET /openapi.json` — calls `generateOpenApiDocument()` on each request and returns it as JSON.
- `GET /docs` — returns `SCALAR_REFERENCE_HTML`, a static HTML page that loads [Scalar's API Reference UI](https://github.com/scalar/scalar) from a CDN (`<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference">`) pointed at `./openapi.json`. No `@scalar/hono-api-reference` (or any Scalar npm package) is installed — the whole UI is one `<script>` tag, so it works unmodified as a plain static file.

## Static deployment

`pnpm build:openapi-static` (in `apps/api`) runs `src/scripts/build-openapi-static.ts`, which writes `openapi.json` and `index.html` (the same `SCALAR_REFERENCE_HTML`) to `apps/api/openapi/dist/`. That directory is a complete, self-contained static bundle — copy both files anywhere (a CDN bucket, GitHub Pages, etc.) and the reference UI works with zero backend, since `index.html` only ever fetches the sibling `openapi.json` over a relative URL.

## Adding a new documented endpoint

1. Make sure the endpoint's request and/or response already has a `Schema.Struct` in `packages/api/src/schemas/*` (see [Effect Schema for Requests and Responses](./effect-schema.md), which also covers `PaginatedResponseSchema` for list endpoints).
2. Add one entry to the `ROUTES` array in `packages/api/src/openapi.ts` referencing that schema.
3. Nothing else changes — `/openapi.json`, `/docs`, and `pnpm build:openapi-static` all pick it up automatically.
