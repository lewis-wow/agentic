import type { ValueOfEnum } from '@repo/types';
import { Schema } from 'effect';

import { IsoDateFromPrisma } from './prisma.js';

// Flag schemas, flag event schemas, FLAG_TYPE/FLAG_STATUS const enums, and their FromPrisma transforms.
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
  CUSTOM: 'CUSTOM',
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

// Raw shape: one row from `prisma.flag.findMany` with
// `include: { states: { where: { environmentId }, select: { status, type, rollout } } }`
// — `states` is an array because Prisma always returns the relation as a
// list, even filtered down to at most one row for a single environment.
const FlagListItemFromPrismaRawSchema = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  name: Schema.String,
  createdAt: IsoDateFromPrisma,
  updatedAt: IsoDateFromPrisma,
  states: Schema.Array(
    Schema.Struct({
      status: Schema.Enums(FLAG_STATUS),
      type: Schema.Enums(FLAG_TYPE),
      rollout: Schema.Number,
    }),
  ),
});

export const FlagListItemFromPrisma = Schema.transform(
  FlagListItemFromPrismaRawSchema,
  FlagListItemSchema,
  {
    strict: true,
    // `IsoDateFromPrisma` already turned createdAt/updatedAt into strings by
    // the time this callback runs — see packages/api/src/schemas/prisma.ts.
    decode: (raw) => ({
      id: raw.id,
      key: raw.key,
      name: raw.name,
      status: raw.states[0]?.status ?? FLAG_STATUS.INACTIVE,
      type: raw.states[0]?.type ?? FLAG_TYPE.BOOLEAN,
      rollout: raw.states[0]?.rollout ?? 0,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    }),
    encode: (item) => ({
      id: item.id,
      key: item.key,
      name: item.name,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      states: [{ status: item.status, type: item.type, rollout: item.rollout }],
    }),
  },
);

// Bare flag row, no per-environment states — returned by create/rename.
export const FlagSchema = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  name: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

export type Flag = Schema.Schema.Type<typeof FlagSchema>;

// Raw shape: matches `prisma.flag.create/update` with no `include`.
const FlagFromPrismaRawSchema = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  name: Schema.String,
  createdAt: IsoDateFromPrisma,
  updatedAt: IsoDateFromPrisma,
});

export const FlagFromPrisma = Schema.transform(
  FlagFromPrismaRawSchema,
  FlagSchema,
  {
    strict: true,
    decode: (raw) => raw,
    encode: (flag) => flag,
  },
);

// Wire shape: flat, dashboard-facing.
export const FlagStateSchema = Schema.Struct({
  id: Schema.String,
  environmentId: Schema.String,
  environmentName: Schema.String,
  status: Schema.Enums(FLAG_STATUS),
  type: Schema.Enums(FLAG_TYPE),
  rollout: Schema.Number,
  rules: Schema.Array(TargetingRuleSchema),
});

export type FlagStateItem = Schema.Schema.Type<typeof FlagStateSchema>;

// Raw shape: matches `prisma.flagState.findUnique/update` with
// `include: { environment: { select: { id, name } } }` — Prisma nests the
// environment relation, but the wire contract wants it flattened onto the
// state. `Schema.transform` is the boundary that does that flattening: decode
// raw Prisma rows straight into `FlagStateSchema`'s wire shape with
// `Schema.decodeUnknownSync(FlagStateFromPrisma)(row)` — no hand-written
// field-by-field remap in the route handler.
const FlagStateFromPrismaRawSchema = Schema.Struct({
  id: Schema.String,
  status: Schema.Enums(FLAG_STATUS),
  type: Schema.Enums(FLAG_TYPE),
  rollout: Schema.Number,
  rules: Schema.Array(TargetingRuleSchema),
  environment: Schema.Struct({ id: Schema.String, name: Schema.String }),
});

export const FlagStateFromPrisma = Schema.transform(
  FlagStateFromPrismaRawSchema,
  FlagStateSchema,
  {
    strict: true,
    decode: (raw) => ({
      id: raw.id,
      environmentId: raw.environment.id,
      environmentName: raw.environment.name,
      status: raw.status,
      type: raw.type,
      rollout: raw.rollout,
      rules: raw.rules,
    }),
    encode: (state) => ({
      id: state.id,
      status: state.status,
      type: state.type,
      rollout: state.rollout,
      rules: state.rules,
      environment: { id: state.environmentId, name: state.environmentName },
    }),
  },
);

export const FlagDetailSchema = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  name: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  states: Schema.Array(FlagStateSchema),
});

export type FlagDetail = Schema.Schema.Type<typeof FlagDetailSchema>;

// Raw shape: matches `prisma.flag.findUnique/findUniqueOrThrow` with
// `include: { states: { include: { environment: { select: { id, name } } } } }`.
const FlagDetailFromPrismaRawSchema = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  name: Schema.String,
  createdAt: IsoDateFromPrisma,
  updatedAt: IsoDateFromPrisma,
  states: Schema.Array(FlagStateFromPrismaRawSchema),
});

export const FlagDetailFromPrisma = Schema.transform(
  FlagDetailFromPrismaRawSchema,
  FlagDetailSchema,
  {
    strict: true,
    decode: (raw) => ({
      id: raw.id,
      key: raw.key,
      name: raw.name,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      states: raw.states.map((s) => ({
        id: s.id,
        environmentId: s.environment.id,
        environmentName: s.environment.name,
        status: s.status,
        type: s.type,
        rollout: s.rollout,
        rules: s.rules,
      })),
    }),
    encode: (detail) => ({
      id: detail.id,
      key: detail.key,
      name: detail.name,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
      states: detail.states.map((s) => ({
        id: s.id,
        status: s.status,
        type: s.type,
        rollout: s.rollout,
        rules: s.rules,
        environment: { id: s.environmentId, name: s.environmentName },
      })),
    }),
  },
);
