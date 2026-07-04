import { Schema } from 'effect';

import { PaginatedResponseSchema } from './pagination.js';

export const ApiKeyListItemSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  apiKeyId: Schema.String,
  environmentId: Schema.String,
  environmentName: Schema.String,
  revokedAt: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
});

export type ApiKeyListItem = Schema.Schema.Type<typeof ApiKeyListItemSchema>;

export const ApiKeyListPageSchema =
  PaginatedResponseSchema(ApiKeyListItemSchema);

export type ApiKeyListPage = Schema.Schema.Type<typeof ApiKeyListPageSchema>;
