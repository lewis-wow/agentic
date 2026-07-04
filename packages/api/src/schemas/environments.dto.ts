import { Schema } from 'effect';

import { EnvironmentSchema } from './environments.js';
import { PaginatedResponseSchema } from './pagination.js';

export const EnvironmentListPageSchema =
  PaginatedResponseSchema(EnvironmentSchema);

export type EnvironmentListPage = Schema.Schema.Type<
  typeof EnvironmentListPageSchema
>;

export const EnvironmentListQuerySchema = Schema.Struct({
  search: Schema.optional(Schema.String),
});

export const EnvironmentIdParamSchema = Schema.Struct({
  environmentId: Schema.String.pipe(Schema.minLength(1)),
});
