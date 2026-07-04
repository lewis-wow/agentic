import { Schema } from 'effect';

import { PaginatedResponseSchema } from './pagination.js';

export const EnvironmentSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
});

export type Environment = Schema.Schema.Type<typeof EnvironmentSchema>;

export const EnvironmentListPageSchema =
  PaginatedResponseSchema(EnvironmentSchema);

export type EnvironmentListPage = Schema.Schema.Type<
  typeof EnvironmentListPageSchema
>;

// --- Route input schemas (path params / query string) ---

export const EnvironmentListQuerySchema = Schema.Struct({
  search: Schema.optional(Schema.String),
});

export const EnvironmentIdParamSchema = Schema.Struct({
  environmentId: Schema.String.pipe(Schema.minLength(1)),
});
