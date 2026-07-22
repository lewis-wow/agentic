import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import {
  FLAG_TYPE,
  FlagSnapshotResponseSchema,
  RULE_OPERATOR,
  RULE_OPERATOR_VALUES,
  TargetingRuleSchema,
} from '../../src/index.js';

describe('RULE_OPERATOR', () => {
  it('exposes EQ, NEQ, IN, NOT_IN, CONTAINS, CUSTOM as const values', () => {
    expect(RULE_OPERATOR.EQ).toBe('EQ');
    expect(RULE_OPERATOR.NEQ).toBe('NEQ');
    expect(RULE_OPERATOR.IN).toBe('IN');
    expect(RULE_OPERATOR.NOT_IN).toBe('NOT_IN');
    expect(RULE_OPERATOR.CONTAINS).toBe('CONTAINS');
    expect(RULE_OPERATOR.CUSTOM).toBe('CUSTOM');
  });
});

describe('RULE_OPERATOR_VALUES', () => {
  it('contains exactly the RULE_OPERATOR values, derived from RULE_OPERATOR itself', () => {
    expect(RULE_OPERATOR_VALUES).toEqual(Object.values(RULE_OPERATOR));
  });

  it('is accepted in full by TargetingRuleSchema.operator', () => {
    for (const operator of RULE_OPERATOR_VALUES) {
      const raw = { attribute: 'plan', operator, value: ['pro'] };
      expect(() =>
        Schema.decodeUnknownSync(TargetingRuleSchema)(raw),
      ).not.toThrow();
    }
  });
});

describe('FLAG_TYPE', () => {
  it('includes TARGETED', () => {
    expect(FLAG_TYPE.TARGETED).toBe('targeted');
  });
});

describe('TargetingRuleSchema', () => {
  it('decodes a valid EQ rule', () => {
    const raw = { attribute: 'plan', operator: 'EQ', value: ['pro'] };
    const result = Schema.decodeUnknownSync(TargetingRuleSchema)(raw);
    expect(result).toEqual(raw);
  });

  it('decodes a valid IN rule with multiple values', () => {
    const raw = {
      attribute: 'country',
      operator: 'IN',
      value: ['US', 'CA', 'GB'],
    };
    const result = Schema.decodeUnknownSync(TargetingRuleSchema)(raw);
    expect(result).toEqual(raw);
  });

  it('decodes a valid CUSTOM rule with an empty attribute and a handler name as the value', () => {
    const raw = { attribute: '', operator: 'CUSTOM', value: ['isBetaTester'] };
    const result = Schema.decodeUnknownSync(TargetingRuleSchema)(raw);
    expect(result).toEqual(raw);
  });

  it('rejects an unknown operator', () => {
    const raw = { attribute: 'plan', operator: 'STARTS_WITH', value: ['pro'] };
    expect(() => Schema.decodeUnknownSync(TargetingRuleSchema)(raw)).toThrow();
  });

  it('rejects a missing attribute', () => {
    const raw = { operator: 'EQ', value: ['pro'] };
    expect(() => Schema.decodeUnknownSync(TargetingRuleSchema)(raw)).toThrow();
  });

  it('rejects a non-string-array value', () => {
    const raw = { attribute: 'plan', operator: 'EQ', value: 'pro' };
    expect(() => Schema.decodeUnknownSync(TargetingRuleSchema)(raw)).toThrow();
  });
});

describe('FlagSnapshotResponseSchema', () => {
  it('decodes a valid snapshot response', () => {
    const raw = {
      flags: [
        {
          key: 'dark-mode',
          enabled: true,
          type: 'boolean',
          rollout: 0,
          rules: [],
        },
        {
          key: 'new-onboarding',
          enabled: false,
          type: 'percentage_rollout',
          rollout: 42,
          rules: [],
        },
      ],
    };

    const result = Schema.decodeUnknownSync(FlagSnapshotResponseSchema)(raw);

    expect(result).toEqual(raw);
  });

  it('decodes a targeted flag with rules', () => {
    const raw = {
      flags: [
        {
          key: 'beta',
          enabled: true,
          type: 'targeted',
          rollout: 0,
          rules: [{ attribute: 'plan', operator: 'EQ', value: ['pro'] }],
        },
      ],
    };
    const result = Schema.decodeUnknownSync(FlagSnapshotResponseSchema)(raw);
    expect(result).toEqual(raw);
  });

  it('rejects a response with a missing enabled field', () => {
    const raw = {
      flags: [{ key: 'dark-mode', type: 'boolean', rollout: 0, rules: [] }],
    };

    expect(() =>
      Schema.decodeUnknownSync(FlagSnapshotResponseSchema)(raw),
    ).toThrow();
  });

  it('rejects a response with a non-boolean enabled', () => {
    const raw = {
      flags: [
        {
          key: 'dark-mode',
          enabled: 'yes',
          type: 'boolean',
          rollout: 0,
          rules: [],
        },
      ],
    };

    expect(() =>
      Schema.decodeUnknownSync(FlagSnapshotResponseSchema)(raw),
    ).toThrow();
  });

  it('rejects a response with a missing type field', () => {
    const raw = {
      flags: [{ key: 'dark-mode', enabled: true, rollout: 0, rules: [] }],
    };

    expect(() =>
      Schema.decodeUnknownSync(FlagSnapshotResponseSchema)(raw),
    ).toThrow();
  });

  it('rejects a response with a missing rollout field', () => {
    const raw = {
      flags: [{ key: 'dark-mode', enabled: true, type: 'boolean', rules: [] }],
    };

    expect(() =>
      Schema.decodeUnknownSync(FlagSnapshotResponseSchema)(raw),
    ).toThrow();
  });

  it('rejects a response with a missing rules field', () => {
    const raw = {
      flags: [{ key: 'dark-mode', enabled: true, type: 'boolean', rollout: 0 }],
    };

    expect(() =>
      Schema.decodeUnknownSync(FlagSnapshotResponseSchema)(raw),
    ).toThrow();
  });
});
