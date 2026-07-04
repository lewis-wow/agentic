import { Schema } from 'effect';

export const UserSummarySchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
});

export type UserSummary = Schema.Schema.Type<typeof UserSummarySchema>;

export const MemberListItemSchema = Schema.Struct({
  id: Schema.String,
  role: Schema.String,
  user: UserSummarySchema,
});

export type MemberListItem = Schema.Schema.Type<typeof MemberListItemSchema>;
