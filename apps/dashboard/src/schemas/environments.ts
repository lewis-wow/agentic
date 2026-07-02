import { Schema } from 'effect';

export const CreateEnvironmentFormSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.minLength(1, { message: () => 'Name is required' }),
  ),
});

export type CreateEnvironmentFormValues = Schema.Schema.Type<
  typeof CreateEnvironmentFormSchema
>;

export const makeDeleteEnvironmentFormSchema = (
  environmentName: string,
): Schema.Schema<{ confirmation: string }> =>
  Schema.Struct({
    confirmation: Schema.String.pipe(
      Schema.filter((value) => value === environmentName, {
        message: () => `Type "${environmentName}" to confirm`,
      }),
    ),
  });

export type DeleteEnvironmentFormValues = { confirmation: string };
