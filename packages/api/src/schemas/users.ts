import { Schema } from 'effect';

import { PaginatedResponseSchema } from './pagination.js';

export const UserListItemSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  role: Schema.String,
});

export type UserListItem = Schema.Schema.Type<typeof UserListItemSchema>;

export const UserListPageSchema = PaginatedResponseSchema(UserListItemSchema);

export type UserListPage = Schema.Schema.Type<typeof UserListPageSchema>;

export const UserListQuerySchema = Schema.Struct({
  search: Schema.optional(Schema.String),
});
