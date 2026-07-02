import { Schema } from 'effect';

const FLAG_KEY_PATTERN = /^[a-z0-9-]+$/;

export const CreateFlagFormSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.minLength(1, { message: () => 'Name is required' }),
  ),
  key: Schema.String.pipe(
    Schema.minLength(1, { message: () => 'Key is required' }),
    Schema.pattern(FLAG_KEY_PATTERN, {
      message: () => 'Lowercase letters, digits, and hyphens only',
    }),
  ),
});

export type CreateFlagFormValues = Schema.Schema.Type<
  typeof CreateFlagFormSchema
>;

export const RenameFlagFormSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.minLength(1, { message: () => 'Name is required' }),
  ),
});

export type RenameFlagFormValues = Schema.Schema.Type<
  typeof RenameFlagFormSchema
>;

export const RuleFormSchema = Schema.Struct({
  attribute: Schema.String.pipe(
    Schema.minLength(1, { message: () => 'Attribute is required' }),
  ),
  operator: Schema.Literal('EQ', 'NEQ', 'IN', 'NOT_IN', 'CONTAINS'),
  valueRaw: Schema.String.pipe(
    Schema.minLength(1, { message: () => 'At least one value is required' }),
  ),
});

export type RuleFormValues = Schema.Schema.Type<typeof RuleFormSchema>;

export const RulesFormSchema = Schema.Struct({
  rules: Schema.Array(RuleFormSchema),
});

export type RulesFormValues = Schema.Schema.Type<typeof RulesFormSchema>;

export const makeDeleteFlagFormSchema = (
  flagName: string,
): Schema.Schema<{ confirmation: string }> =>
  Schema.Struct({
    confirmation: Schema.String.pipe(
      Schema.filter((value) => value === flagName, {
        message: () => `Type "${flagName}" to confirm`,
      }),
    ),
  });

export type DeleteFlagFormValues = { confirmation: string };
