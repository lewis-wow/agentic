import { Schema } from 'effect';

export const FlagConfigSchema = Schema.Struct({
  key: Schema.String,
  enabled: Schema.Boolean,
});

export type FlagConfig = Schema.Schema.Type<typeof FlagConfigSchema>;

export const FlagSnapshotResponseSchema = Schema.Struct({
  flags: Schema.Array(FlagConfigSchema),
});

export type FlagSnapshotResponse = Schema.Schema.Type<
  typeof FlagSnapshotResponseSchema
>;

// Upsert events
export const FlagCreatedEventSchema = Schema.Struct({
  key: Schema.String,
  enabled: Schema.Boolean,
});
export type FlagCreatedEvent = Schema.Schema.Type<
  typeof FlagCreatedEventSchema
>;

export const FlagUpdatedEventSchema = Schema.Struct({
  key: Schema.String,
  enabled: Schema.Boolean,
});
export type FlagUpdatedEvent = Schema.Schema.Type<
  typeof FlagUpdatedEventSchema
>;

export const FlagUnarchivedEventSchema = Schema.Struct({
  key: Schema.String,
  enabled: Schema.Boolean,
});
export type FlagUnarchivedEvent = Schema.Schema.Type<
  typeof FlagUnarchivedEventSchema
>;

// Remove events
export const FlagArchivedEventSchema = Schema.Struct({ key: Schema.String });
export type FlagArchivedEvent = Schema.Schema.Type<
  typeof FlagArchivedEventSchema
>;

export const FlagDeletedEventSchema = Schema.Struct({ key: Schema.String });
export type FlagDeletedEvent = Schema.Schema.Type<
  typeof FlagDeletedEventSchema
>;
