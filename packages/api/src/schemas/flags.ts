import type { ValueOfEnum } from '@repo/types';
import { Schema } from 'effect';

import { PaginatedResponseSchema } from './pagination.js';

export const FLAG_TYPE = {
  BOOLEAN: 'boolean',
  PERCENTAGE_ROLLOUT: 'percentage_rollout',
  TARGETED: 'targeted',
} as const;

export type FlagType = ValueOfEnum<typeof FLAG_TYPE>;

export const FLAG_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
} as const;

export type FlagStatus = ValueOfEnum<typeof FLAG_STATUS>;

export const FLAG_STATUS_VALUES = Object.values(FLAG_STATUS) as [
  FlagStatus,
  ...FlagStatus[],
];

export const RULE_OPERATOR = {
  EQ: 'EQ',
  NEQ: 'NEQ',
  IN: 'IN',
  NOT_IN: 'NOT_IN',
  CONTAINS: 'CONTAINS',
} as const;

export type RuleOperator = ValueOfEnum<typeof RULE_OPERATOR>;

export const RULE_OPERATOR_VALUES = Object.values(RULE_OPERATOR) as [
  RuleOperator,
  ...RuleOperator[],
];

export const TargetingRuleSchema = Schema.Struct({
  attribute: Schema.String,
  operator: Schema.Enums(RULE_OPERATOR),
  value: Schema.Array(Schema.String),
});

export type TargetingRule = Schema.Schema.Type<typeof TargetingRuleSchema>;

export const FlagConfigSchema = Schema.Struct({
  key: Schema.String,
  enabled: Schema.Boolean,
  type: Schema.Enums(FLAG_TYPE),
  rollout: Schema.Number,
  rules: Schema.Array(TargetingRuleSchema),
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
  type: Schema.Enums(FLAG_TYPE),
  rollout: Schema.Number,
  rules: Schema.Array(TargetingRuleSchema),
});
export type FlagCreatedEvent = Schema.Schema.Type<
  typeof FlagCreatedEventSchema
>;

export const FlagUpdatedEventSchema = Schema.Struct({
  key: Schema.String,
  enabled: Schema.Boolean,
  type: Schema.Enums(FLAG_TYPE),
  rollout: Schema.Number,
  rules: Schema.Array(TargetingRuleSchema),
});
export type FlagUpdatedEvent = Schema.Schema.Type<
  typeof FlagUpdatedEventSchema
>;

export const FlagUnarchivedEventSchema = Schema.Struct({
  key: Schema.String,
  enabled: Schema.Boolean,
  type: Schema.Enums(FLAG_TYPE),
  rollout: Schema.Number,
  rules: Schema.Array(TargetingRuleSchema),
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

// Dashboard list view (one row per flag, scoped to a single environment)
export const FlagListItemSchema = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  name: Schema.String,
  status: Schema.Enums(FLAG_STATUS),
  type: Schema.Enums(FLAG_TYPE),
  rollout: Schema.Number,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

export type FlagListItem = Schema.Schema.Type<typeof FlagListItemSchema>;

export const FlagListPageSchema = PaginatedResponseSchema(FlagListItemSchema);

export type FlagListPage = Schema.Schema.Type<typeof FlagListPageSchema>;
