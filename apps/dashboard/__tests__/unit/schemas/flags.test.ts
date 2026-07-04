import { RULE_OPERATOR_VALUES } from '@repo/api';
import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { RuleFormSchema } from '../../../src/schemas/flags.js';

describe('RuleFormSchema', () => {
  it('accepts every operator in RULE_OPERATOR_VALUES', () => {
    for (const operator of RULE_OPERATOR_VALUES) {
      const raw = { attribute: 'plan', operator, valueRaw: 'pro' };
      expect(() => Schema.decodeUnknownSync(RuleFormSchema)(raw)).not.toThrow();
    }
  });

  it('rejects an operator not in RULE_OPERATOR_VALUES', () => {
    const raw = { attribute: 'plan', operator: 'STARTS_WITH', valueRaw: 'pro' };
    expect(() => Schema.decodeUnknownSync(RuleFormSchema)(raw)).toThrow();
  });
});
