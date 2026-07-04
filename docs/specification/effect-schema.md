# Effect Schema for Requests and Responses

Every HTTP request body and response shape must be defined as an Effect `Schema.Struct`. The schema is the single source of truth for:

- **Runtime validation** — decode and validate incoming request data at the boundary.
- **Type inference** — derive the TypeScript type from the schema; never write the type manually alongside a schema.
- **Encoding** — encode outgoing response data through the schema before sending, so transport representation stays consistent with the declared contract.

Never validate request/response shapes with plain TypeScript types, manual type guards, or Zod. Always use Effect Schema.

**Always export both the schema and its inferred type together, even if the type is not consumed anywhere yet:**

```ts
import { Schema } from 'effect';

export const FlagConfigSchema = Schema.Struct({
  key: Schema.String,
  enabled: Schema.Boolean,
});

export type FlagConfig = Schema.Schema.Type<typeof FlagConfigSchema>;
```

The type export is cheap and makes the contract immediately usable by consumers without requiring them to write `Schema.Schema.Type<typeof …>` at every callsite. Never export one without the other.

**Use `Schema.Enums` for fields backed by an `as const` enum object, never `Schema.Literal`.** When a field's valid values are exactly the values of an existing `as const` object (see [Enums and Constants](./enums-and-constants.md)), validate it with `Schema.Enums(THE_CONST)` instead of spelling out `Schema.Literal(THE_CONST.A, THE_CONST.B, ...)` or `Schema.Literal(...Object.values(THE_CONST))`. It stays in sync automatically as members are added or removed, and its decoded type (`Schema.Enums(X)` → `X[keyof typeof X]`) already matches `ValueOfEnum<typeof X>`.

```ts
// Correct
export const FLAG_TYPE = {
  BOOLEAN: 'boolean',
  TARGETED: 'targeted',
} as const;

const FlagConfigSchema = Schema.Struct({
  type: Schema.Enums(FLAG_TYPE),
});

// Incorrect — drifts if FLAG_TYPE gains/loses a member
const FlagConfigSchema = Schema.Struct({
  type: Schema.Literal(FLAG_TYPE.BOOLEAN, FLAG_TYPE.TARGETED),
});
```

`Schema.Literal` is still the right tool for ad hoc literal unions that aren't backed by an exported `as const` object.

**Use `PaginatedResponseSchema` for any paginated list response — never hand-write the envelope.** `packages/api/src/schemas/pagination.ts` exports `PaginatedResponseSchema(itemSchema)`, which wraps an item schema in the project's standard pagination envelope: `{ items: itemSchema[], total: number, page: number, limit: number }`. Every paginated endpoint uses this exact field name (`items`) for its array — never a domain-specific name like `flags`, `users`, or `members` — so `packages/pagination`'s client-side `PagedResponse<T>` type and `usePaginatedQuery` hook can consume any paginated endpoint's response with zero remapping.

```ts
import { Schema } from 'effect';

import { PaginatedResponseSchema } from './pagination.js';

export const FlagListItemSchema = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
});

export type FlagListItem = Schema.Schema.Type<typeof FlagListItemSchema>;

export const FlagListPageSchema = PaginatedResponseSchema(FlagListItemSchema);

export type FlagListPage = Schema.Schema.Type<typeof FlagListPageSchema>;
```

The route handler encodes through it like any other response schema (see [`Schema.encodeSync`](https://effect.website/docs/schema/getting-started/#encoding) usage in `apps/api/src/routes/*.ts`):

```ts
const encoded = Schema.encodeSync(FlagListPageSchema)({ items, total, page, limit });
return c.json(encoded);
```

If an endpoint needs an extra field alongside the page (e.g. the members list also returns the project `owner`), build the `Schema.Struct` by hand and spread the exported `PageMetaFields` (`{ total, page, limit }`) instead of calling `PaginatedResponseSchema` — see `MemberListPageSchema` for the pattern.

## Every schema lives in `packages/api`, never in `apps/api`

Request bodies, response shapes, path params, and query strings are **all** Effect Schemas defined in `packages/api/src/schemas/*.ts` — including the small ones. A route file in `apps/api` never declares its own `Schema.Struct` inline, even for something as small as `Schema.Struct({ flagId: Schema.String })`. Import it from `@repo/api` instead:

```ts
// packages/api/src/schemas/flags.ts
export const FlagIdParamSchema = Schema.Struct({
  flagId: Schema.String.pipe(Schema.minLength(1)),
});

// apps/api/src/routes/flags.ts
import { FlagIdParamSchema } from '@repo/api';
```

Reason: `packages/api` is the single contract layer between `apps/api` and every consumer (dashboard, SDKs, other services). A schema defined inside `apps/api` can't be reused or reasoned about from outside that app, and it splits "the contract" across two packages for no benefit — path param and query schemas are just as much a part of a route's contract as its body schema.

## Validating Hono route input

Every route handler that reads a JSON body, query string, or path params validates it through `apps/api/src/validation.ts`'s `validate(target, schema)` helper — never by hand (`await c.req.json()` + `typeof` checks, manual `c.req.param()` destructuring trusted as-is, ad hoc regexes). `validate` wraps [`@hono/standard-validator`](https://github.com/honojs/middleware/tree/main/packages/standard-validator)'s `sValidator` around `Schema.standardSchemaV1(schema)` — the bridge Effect Schema provides for any [Standard Schema](https://standardschema.dev/)-compliant validation middleware — and on failure returns `RequestValidationFailed` (a `BAD_REQUEST_400` `HttpException`) instead of the library's default response shape, so failures still go through this app's normal exception path (see [Error Handling](./error-handling.md)).

```ts
import { FlagIdParamSchema, RenameFlagRequestSchema } from '@repo/api';

flagsRouter.patch(
  '/:flagId',
  validate('param', FlagIdParamSchema),
  validate('json', RenameFlagRequestSchema),
  async (c) => {
    const { flagId } = c.req.valid('param');
    const { name } = c.req.valid('json');
    // ...
  },
);
```

Fetch validated data with `c.req.valid(target)`, never `c.req.param()`/`c.req.query()`/`c.req.json()` directly — those bypass the schema and return unvalidated, untyped data. Skip `validate('param', ...)` only when the handler never reads that path param at all (e.g. `/projects/:projectId/...` routes that derive the project from JWT claims instead — see `apps/api/AGENTS.md`).

One exception file replaces what used to be a pile of field-specific "X is required" / "invalid X" exceptions (`FlagKeyRequired`, `InvalidFlagStatus`, `EnvironmentIdRequired`, etc.) for pure request-shape problems — the schema is now the single source of truth for what makes a request malformed, so there's exactly one exception (`RequestValidationFailed`) for "the request didn't decode." Keep dedicated exceptions only for conditions a schema can't express: state that depends on the database (`FlagKeyConflict`, `ApiKeyAlreadyRevoked`, `FlagNotFound`) or authorization (`Forbidden`).

## Every response is validated or encoded before it goes over HTTP

No route handler calls `c.json(...)` with a hand-built plain object it hasn't run through a schema — not even for a single-resource GET that used to return a raw Prisma projection. Every response schema lives in `packages/api` alongside its request counterpart, and the route calls `Schema.encodeSync`/`Schema.decodeUnknownSync` on it before `c.json(...)`.

## Decoding Prisma rows into wire shapes with `Schema.transform`

A Prisma query result almost never matches the wire contract exactly: dates are `Date` instances (the wire wants ISO strings), relations are nested (`flagState.environment.{id,name}`, but the wire wants flat `environmentId`/`environmentName`), and `include`-heavy queries carry columns nothing downstream needs. Reshaping that by hand in the route handler (`.toISOString()`, `.map(...)` field-picking) is exactly the kind of ad hoc conversion this convention exists to avoid.

Instead, define the boundary as an Effect `Schema.transform(rawSchema, wireSchema, { decode, encode })` in `packages/api`, named `<Thing>FromPrisma`, and call `Schema.decodeUnknownSync(<Thing>FromPrisma)(prismaRow)` in the route — the result is already the exact JSON-ready wire object:

```ts
// packages/api/src/schemas/flags.ts
const FlagStateFromPrismaRawSchema = Schema.Struct({
  id: Schema.String,
  status: Schema.Enums(FLAG_STATUS),
  type: Schema.Enums(FLAG_TYPE),
  rollout: Schema.Number,
  rules: Schema.Array(TargetingRuleSchema),
  environment: Schema.Struct({ id: Schema.String, name: Schema.String }),
});

export const FlagStateFromPrisma = Schema.transform(
  FlagStateFromPrismaRawSchema,
  FlagStateSchema, // the plain wire Schema.Struct — Type === Encoded
  {
    strict: true,
    decode: (raw) => ({
      id: raw.id,
      environmentId: raw.environment.id,
      environmentName: raw.environment.name,
      status: raw.status,
      type: raw.type,
      rollout: raw.rollout,
      rules: raw.rules,
    }),
    encode: (state) => ({
      id: state.id,
      status: state.status,
      type: state.type,
      rollout: state.rollout,
      rules: state.rules,
      environment: { id: state.environmentId, name: state.environmentName },
    }),
  },
);
```

```ts
// apps/api/src/routes/flags.ts
const flagDetail = Schema.decodeUnknownSync(FlagDetailFromPrisma)(flag);
return c.json({ flag: flagDetail });
```

Rules for this pattern:

- **The exported "contract" schema (`FlagStateSchema`, `FlagDetailSchema`, ...) never changes shape or field types for this.** Its `Type` must stay exactly what a consumer receives as JSON (e.g. `createdAt: Schema.String`, not `Schema.Date`) — dashboard and SDK code imports these types directly to mean "the shape I get over HTTP." All the raw-Prisma-specific typing (`Schema.DateFromSelf`, nested relation objects) lives only in the paired `<Thing>FromPrismaRawSchema`, which is not exported unless another module genuinely needs it.
- **Use `IsoDateFromPrisma` (`packages/api/src/schemas/prisma.ts`) for every date field on a raw schema.** It's `Schema.transform(Schema.DateFromSelf, Schema.String, ...)` — Type is `string`, Encoded is `Date` — so a raw schema's own decode already turns Prisma's `Date` instances into ISO strings before your `decode` callback runs. That means the callback never calls `.toISOString()`/`new Date(...)` itself; it only reshapes structure (flattening, dropping fields).
- **If a response needs no restructuring beyond dropping excess Prisma columns** (e.g. `EnvironmentSchema`'s `{ id, name }` from a full `Environment` row), skip the transform entirely — `Schema.decodeUnknownSync(EnvironmentSchema)(prismaRow)` already drops the excess columns on decode, because Effect Schema silently ignores properties a `Schema.Struct` doesn't declare.
- **If a response needs no restructuring and has no date fields at all** (bare ID lookups, request-echoing responses), a transform adds nothing — just `Schema.encodeSync`/`decodeUnknownSync` the plain schema directly.
