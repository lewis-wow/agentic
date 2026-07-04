# Schema File Organization: `<name>.ts` vs `<name>.dto.ts`

Every resource in `packages/api/src/schemas/` splits its Effect Schemas across two files:

- **`<name>.ts`** — the resource's main models: the canonical entity/wire shapes (e.g. `FlagSchema`, `FlagDetailSchema`, `FlagListItemSchema`), backing enums/constants, and their `Schema.transform` pairs for decoding Prisma rows (`<Thing>FromPrisma`, `<Thing>FromPrismaRawSchema`) — even though these involve transformation logic, they still describe what the entity _is_, not a specific request/response.
- **`<name>.dto.ts`** — everything specific to an individual endpoint's request/response contract: request bodies (`Create*Request`, `Rename*Request`, `Update*Request`), path params (`*IdParamSchema`), query strings (`*ListQuerySchema`), and response envelopes that wrap the main model for one particular endpoint (list pages via `PaginatedResponseSchema`, action responses like `CreateApiKeyResponseSchema`). Query/body schemas that are inferred from a main model (e.g. an update request built from a subset of the model's fields) belong here too, importing the main model's schema from `<name>.ts` rather than redeclaring it.

```ts
// packages/api/src/schemas/flags.ts — main model
export const FlagDetailSchema = Schema.Struct({
  /* ... */
});
export type FlagDetail = Schema.Schema.Type<typeof FlagDetailSchema>;
export const FlagDetailFromPrisma = Schema.transform(/* ... */);
```

```ts
// packages/api/src/schemas/flags.dto.ts — request-specific
import { FlagListItemSchema } from './flags.js';

export const FlagListQuerySchema = Schema.Struct({
  /* ... */
});
export const FlagListPageSchema = PaginatedResponseSchema(FlagListItemSchema);
```

A `.dto.ts` file may import from its sibling `.ts` file; a `.ts` file never imports from a `.dto.ts` file — main models must not depend on any single endpoint's contract. Shared, resource-agnostic infrastructure (`pagination.ts`, `prisma.ts`) is exempt from this split since it isn't scoped to one resource.

The barrel `packages/api/src/index.ts` re-exports both files for every resource — see [Barrel Files](./barrel-files.md). See [Effect Schema for Requests and Responses](./effect-schema.md) for the schema-authoring rules themselves (type exports, `Schema.Enums`, `Schema.transform` patterns) that apply equally to both files.
