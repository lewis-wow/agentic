import { Schema } from 'effect';

import { PageMetaFields } from './pagination.js';

const MemberUserSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
});

export const MemberListItemSchema = Schema.Struct({
  id: Schema.String,
  role: Schema.String,
  user: MemberUserSchema,
});

export type MemberListItem = Schema.Schema.Type<typeof MemberListItemSchema>;

// Not a plain PaginatedResponseSchema(MemberListItemSchema): this envelope
// also carries the project owner, who is never a ProjectMember row but is
// always listed alongside the page of members in the dashboard's UI.
export const MemberListPageSchema = Schema.Struct({
  owner: Schema.NullOr(MemberUserSchema),
  items: Schema.Array(MemberListItemSchema),
  ...PageMetaFields,
});

export type MemberListPage = Schema.Schema.Type<typeof MemberListPageSchema>;
