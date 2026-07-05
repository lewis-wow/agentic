import { Schema } from 'effect';

import { ProjectListItemSchema } from './projects.js';

// Project/environment/API-key request schemas.
const NonBlankName = Schema.String.pipe(
  Schema.filter((value) => value.trim().length > 0),
);

export const CreateProjectRequestSchema = Schema.Struct({
  name: NonBlankName,
});

export type CreateProjectRequest = Schema.Schema.Type<
  typeof CreateProjectRequestSchema
>;

export const RenameProjectRequestSchema = Schema.Struct({
  name: NonBlankName,
});

export type RenameProjectRequest = Schema.Schema.Type<
  typeof RenameProjectRequestSchema
>;

export const CreateEnvironmentRequestSchema = Schema.Struct({
  name: NonBlankName,
});

export type CreateEnvironmentRequest = Schema.Schema.Type<
  typeof CreateEnvironmentRequestSchema
>;

export const CreateApiKeyRequestSchema = Schema.Struct({
  name: NonBlankName,
  environmentId: Schema.String.pipe(Schema.minLength(1)),
});

export type CreateApiKeyRequest = Schema.Schema.Type<
  typeof CreateApiKeyRequestSchema
>;

export const ProjectListResponseSchema = Schema.Struct({
  projects: Schema.Array(ProjectListItemSchema),
});

export type ProjectListResponse = Schema.Schema.Type<
  typeof ProjectListResponseSchema
>;
