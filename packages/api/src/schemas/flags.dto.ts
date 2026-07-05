import { Schema } from 'effect';

import {
  FLAG_STATUS_VALUES,
  FLAG_TYPE,
  FlagConfigSchema,
  FlagListItemSchema,
  TargetingRuleSchema,
} from './flags.js';
import { PaginatedResponseSchema } from './pagination.js';

// Flag request bodies, route param/query schemas, and the paginated flag list schema.
export const FlagSnapshotResponseSchema = Schema.Struct({
  flags: Schema.Array(FlagConfigSchema),
});

export type FlagSnapshotResponse = Schema.Schema.Type<
  typeof FlagSnapshotResponseSchema
>;

const NonBlankString = Schema.String.pipe(
  Schema.filter((value) => value.trim().length > 0),
);

const FlagKeySchema = NonBlankString.pipe(Schema.pattern(/^[a-z0-9-]+$/));

export const CreateFlagRequestSchema = Schema.Struct({
  key: FlagKeySchema,
  name: NonBlankString,
});

export type CreateFlagRequest = Schema.Schema.Type<
  typeof CreateFlagRequestSchema
>;

export const RenameFlagRequestSchema = Schema.Struct({
  name: NonBlankString,
});

export type RenameFlagRequest = Schema.Schema.Type<
  typeof RenameFlagRequestSchema
>;

const RolloutSchema = Schema.Number.pipe(Schema.int(), Schema.between(0, 100));

export const UpdateFlagStateRequestSchema = Schema.Struct({
  status: Schema.optional(Schema.Literal('active', 'inactive')),
  type: Schema.optional(Schema.Enums(FLAG_TYPE)),
  rollout: Schema.optional(RolloutSchema),
  rules: Schema.optional(Schema.Array(TargetingRuleSchema)),
}).pipe(
  Schema.filter(
    (value) =>
      value.status !== undefined ||
      value.type !== undefined ||
      value.rollout !== undefined ||
      value.rules !== undefined,
  ),
);

export type UpdateFlagStateRequest = Schema.Schema.Type<
  typeof UpdateFlagStateRequestSchema
>;

export const FlagListPageSchema = PaginatedResponseSchema(FlagListItemSchema);

export type FlagListPage = Schema.Schema.Type<typeof FlagListPageSchema>;

// --- Route input schemas (path params / query string) ---

export const FlagIdParamSchema = Schema.Struct({
  flagId: Schema.String.pipe(Schema.minLength(1)),
});

export const FlagEnvironmentParamSchema = Schema.Struct({
  flagId: Schema.String.pipe(Schema.minLength(1)),
  environmentId: Schema.String.pipe(Schema.minLength(1)),
});

export const FlagListQuerySchema = Schema.Struct({
  environmentId: Schema.String.pipe(Schema.minLength(1)),
  search: Schema.optional(Schema.String),
  status: Schema.optional(Schema.Literal(...FLAG_STATUS_VALUES, 'all')),
});
