import { Schema } from 'effect';

export const CreateApiKeyFormSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.minLength(1, { message: () => 'Name is required' }),
  ),
  environmentId: Schema.String.pipe(
    Schema.minLength(1, { message: () => 'Select an environment' }),
  ),
});

export type CreateApiKeyFormValues = Schema.Schema.Type<
  typeof CreateApiKeyFormSchema
>;

export const makeDeleteApiKeyFormSchema = (
  keyName: string,
): Schema.Schema<{ confirmation: string }> =>
  Schema.Struct({
    confirmation: Schema.String.pipe(
      Schema.filter((value) => value === keyName, {
        message: () => `Type "${keyName}" to confirm`,
      }),
    ),
  });

export type DeleteApiKeyFormValues = { confirmation: string };
