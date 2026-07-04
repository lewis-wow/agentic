import { Schema } from 'effect';

import { EnvironmentSchema } from './environments.js';
import { MemberListItemSchema, UserSummarySchema } from './members.js';
import { IsoDateFromPrisma } from './prisma.js';

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

// Bare project row, no nested resources — returned by create/rename.
export const ProjectSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

export type Project = Schema.Schema.Type<typeof ProjectSchema>;

// Raw shape: matches `prisma.project.create/update` with no `include`.
const ProjectFromPrismaRawSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  createdAt: IsoDateFromPrisma,
  updatedAt: IsoDateFromPrisma,
});

export const ProjectFromPrisma = Schema.transform(
  ProjectFromPrismaRawSchema,
  ProjectSchema,
  { strict: true, decode: (raw) => raw, encode: (project) => project },
);

export const ProjectListItemSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  environments: Schema.Array(EnvironmentSchema),
});

export type ProjectListItem = Schema.Schema.Type<typeof ProjectListItemSchema>;

export const ProjectListResponseSchema = Schema.Struct({
  projects: Schema.Array(ProjectListItemSchema),
});

export type ProjectListResponse = Schema.Schema.Type<
  typeof ProjectListResponseSchema
>;

// Raw shape: matches `prisma.project.findMany` with
// `include: { environments: { select: { id, name } } }`.
const ProjectListItemFromPrismaRawSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  createdAt: IsoDateFromPrisma,
  updatedAt: IsoDateFromPrisma,
  environments: Schema.Array(EnvironmentSchema),
});

export const ProjectListItemFromPrisma = Schema.transform(
  ProjectListItemFromPrismaRawSchema,
  ProjectListItemSchema,
  { strict: true, decode: (raw) => raw, encode: (item) => item },
);

export const ProjectDetailSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  environments: Schema.Array(EnvironmentSchema),
  members: Schema.Array(MemberListItemSchema),
  owner: Schema.NullOr(UserSummarySchema),
});

export type ProjectDetail = Schema.Schema.Type<typeof ProjectDetailSchema>;

// Raw shape: matches `prisma.project.findUnique` with
// `include: { environments: true, members: { include: { user: {...} } } }`
// (full rows — excess columns like `projectId`/timestamps on environments
// and members are dropped automatically by `EnvironmentSchema`/
// `MemberListItemSchema` during decode) plus the separately-queried owner.
const ProjectDetailFromPrismaRawSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  createdAt: IsoDateFromPrisma,
  updatedAt: IsoDateFromPrisma,
  environments: Schema.Array(EnvironmentSchema),
  members: Schema.Array(MemberListItemSchema),
  owner: Schema.NullOr(UserSummarySchema),
});

export const ProjectDetailFromPrisma = Schema.transform(
  ProjectDetailFromPrismaRawSchema,
  ProjectDetailSchema,
  { strict: true, decode: (raw) => raw, encode: (detail) => detail },
);
