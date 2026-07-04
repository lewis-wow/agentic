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
