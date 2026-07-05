import { Schema } from 'effect';

import { EnvironmentSchema } from './environments.js';
import { IsoDateFromPrisma } from './prisma.js';

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
});

export type ProjectDetail = Schema.Schema.Type<typeof ProjectDetailSchema>;

// Raw shape: matches `prisma.project.findUnique` with
// `include: { environments: true } }` (full rows — excess columns like
// `projectId`/timestamps on environments are dropped automatically by
// `EnvironmentSchema` during decode).
const ProjectDetailFromPrismaRawSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  createdAt: IsoDateFromPrisma,
  updatedAt: IsoDateFromPrisma,
  environments: Schema.Array(EnvironmentSchema),
});

export const ProjectDetailFromPrisma = Schema.transform(
  ProjectDetailFromPrismaRawSchema,
  ProjectDetailSchema,
  { strict: true, decode: (raw) => raw, encode: (detail) => detail },
);
