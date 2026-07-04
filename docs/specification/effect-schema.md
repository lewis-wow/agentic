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
