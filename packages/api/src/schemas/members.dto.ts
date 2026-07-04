import { Schema } from 'effect';

import { MemberListItemSchema, UserSummarySchema } from './members.js';
import { PageMetaFields } from './pagination.js';

// Not a plain PaginatedResponseSchema(MemberListItemSchema): this envelope
// also carries the project owner, who is never a ProjectMember row but is
// always listed alongside the page of members in the dashboard's UI.
export const MemberListPageSchema = Schema.Struct({
  owner: Schema.NullOr(UserSummarySchema),
  items: Schema.Array(MemberListItemSchema),
  ...PageMetaFields,
});

export type MemberListPage = Schema.Schema.Type<typeof MemberListPageSchema>;

export const AddableUsersResponseSchema = Schema.Struct({
  users: Schema.Array(UserSummarySchema),
});

export type AddableUsersResponse = Schema.Schema.Type<
  typeof AddableUsersResponseSchema
>;

export const MemberListQuerySchema = Schema.Struct({
  search: Schema.optional(Schema.String),
});

export const AddableUsersQuerySchema = Schema.Struct({
  query: Schema.optional(Schema.String),
});

export const MemberIdParamSchema = Schema.Struct({
  memberId: Schema.String.pipe(Schema.minLength(1)),
});
