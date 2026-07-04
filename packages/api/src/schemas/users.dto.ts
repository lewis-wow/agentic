import { Schema } from 'effect';

import { PaginatedResponseSchema } from './pagination.js';
import { UserListItemSchema } from './users.js';

export const UserListPageSchema = PaginatedResponseSchema(UserListItemSchema);

export type UserListPage = Schema.Schema.Type<typeof UserListPageSchema>;

export const UserListQuerySchema = Schema.Struct({
  search: Schema.optional(Schema.String),
});
