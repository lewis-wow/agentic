import { Schema } from 'effect';

const NonBlankName = Schema.String.pipe(
  Schema.filter((value) => value.trim().length > 0),
);

export const CreateProjectRequestSchema = Schema.Struct({
  name: NonBlankName,
});

export type CreateProjectRequest = Schema.Schema.Type<
  typeof CreateProjectRequestSchema
>;

export const CreateEnvironmentRequestSchema = Schema.Struct({
  name: NonBlankName,
});

export type CreateEnvironmentRequest = Schema.Schema.Type<
  typeof CreateEnvironmentRequestSchema
>;

export const AddMemberRequestSchema = Schema.Struct({
  userId: Schema.String.pipe(Schema.minLength(1)),
  role: Schema.Literal('admin', 'viewer'),
});

export type AddMemberRequest = Schema.Schema.Type<
  typeof AddMemberRequestSchema
>;

export const CreateApiKeyRequestSchema = Schema.Struct({
  name: NonBlankName,
  environmentId: Schema.String.pipe(Schema.minLength(1)),
});

export type CreateApiKeyRequest = Schema.Schema.Type<
  typeof CreateApiKeyRequestSchema
>;
