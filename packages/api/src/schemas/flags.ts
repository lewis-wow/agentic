import { Schema } from 'effect';

export const FLAG_TYPE = {
  BOOLEAN: 'boolean',
  PERCENTAGE_ROLLOUT: 'percentage_rollout',
  TARGETED: 'targeted',
} as const;

export type FlagType = (typeof FLAG_TYPE)[keyof typeof FLAG_TYPE];

export const RULE_OPERATOR = {
  EQ: 'EQ',
  NEQ: 'NEQ',
  IN: 'IN',
  NOT_IN: 'NOT_IN',
  CONTAINS: 'CONTAINS',
} as const;

export type RuleOperator = (typeof RULE_OPERATOR)[keyof typeof RULE_OPERATOR];

export const RULE_OPERATOR_VALUES = Object.values(RULE_OPERATOR) as [
  RuleOperator,
  ...RuleOperator[],
];

export const TargetingRuleSchema = Schema.Struct({
  attribute: Schema.String,
  operator: Schema.Literal(...RULE_OPERATOR_VALUES),
  value: Schema.Array(Schema.String),
});

export type TargetingRule = Schema.Schema.Type<typeof TargetingRuleSchema>;

export const FlagConfigSchema = Schema.Struct({
  key: Schema.String,
  enabled: Schema.Boolean,
  type: Schema.Literal(
    FLAG_TYPE.BOOLEAN,
    FLAG_TYPE.PERCENTAGE_ROLLOUT,
    FLAG_TYPE.TARGETED,
  ),
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
  type: Schema.Literal(
    FLAG_TYPE.BOOLEAN,
    FLAG_TYPE.PERCENTAGE_ROLLOUT,
    FLAG_TYPE.TARGETED,
  ),
  rollout: Schema.Number,
  rules: Schema.Array(TargetingRuleSchema),
});
export type FlagCreatedEvent = Schema.Schema.Type<
  typeof FlagCreatedEventSchema
>;

export const FlagUpdatedEventSchema = Schema.Struct({
  key: Schema.String,
  enabled: Schema.Boolean,
  type: Schema.Literal(
    FLAG_TYPE.BOOLEAN,
    FLAG_TYPE.PERCENTAGE_ROLLOUT,
    FLAG_TYPE.TARGETED,
  ),
  rollout: Schema.Number,
  rules: Schema.Array(TargetingRuleSchema),
});
export type FlagUpdatedEvent = Schema.Schema.Type<
  typeof FlagUpdatedEventSchema
>;

export const FlagUnarchivedEventSchema = Schema.Struct({
  key: Schema.String,
  enabled: Schema.Boolean,
  type: Schema.Literal(
    FLAG_TYPE.BOOLEAN,
    FLAG_TYPE.PERCENTAGE_ROLLOUT,
    FLAG_TYPE.TARGETED,
  ),
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
