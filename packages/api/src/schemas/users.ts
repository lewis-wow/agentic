import { Schema } from 'effect';

export const UserListItemSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  role: Schema.String,
});

export type UserListItem = Schema.Schema.Type<typeof UserListItemSchema>;
