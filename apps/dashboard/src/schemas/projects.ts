import { Schema } from 'effect';

export const CreateProjectFormSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.minLength(1, { message: () => 'Name is required' }),
  ),
});

export type CreateProjectFormValues = Schema.Schema.Type<
  typeof CreateProjectFormSchema
>;

export const makeDeleteProjectFormSchema = (
  projectName: string,
): Schema.Schema<{ confirmation: string }> =>
  Schema.Struct({
    confirmation: Schema.String.pipe(
      Schema.filter((value) => value === projectName, {
        message: () => `Type "${projectName}" to confirm`,
      }),
    ),
  });

export type DeleteProjectFormValues = { confirmation: string };
