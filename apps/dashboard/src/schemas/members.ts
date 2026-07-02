import { Schema } from 'effect';

export const AddMemberFormSchema = Schema.Struct({
  userId: Schema.String.pipe(
    Schema.minLength(1, { message: () => 'Select a user' }),
  ),
  role: Schema.Literal('admin', 'viewer'),
});

export type AddMemberFormValues = Schema.Schema.Type<
  typeof AddMemberFormSchema
>;
