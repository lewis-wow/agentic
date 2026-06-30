import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { FlagSnapshotResponseSchema } from '../../src/index.js';

describe('FlagSnapshotResponseSchema', () => {
  it('decodes a valid snapshot response', () => {
    const raw = {
      flags: [
        { key: 'dark-mode', enabled: true, type: 'boolean', rollout: 0 },
        {
          key: 'new-onboarding',
          enabled: false,
          type: 'percentage_rollout',
          rollout: 42,
        },
      ],
    };

    const result = Schema.decodeUnknownSync(FlagSnapshotResponseSchema)(raw);

    expect(result).toEqual(raw);
  });

  it('rejects a response with a missing enabled field', () => {
    const raw = {
      flags: [{ key: 'dark-mode', type: 'boolean', rollout: 0 }],
    };

    expect(() =>
      Schema.decodeUnknownSync(FlagSnapshotResponseSchema)(raw),
    ).toThrow();
  });

  it('rejects a response with a non-boolean enabled', () => {
    const raw = {
      flags: [
        { key: 'dark-mode', enabled: 'yes', type: 'boolean', rollout: 0 },
      ],
    };

    expect(() =>
      Schema.decodeUnknownSync(FlagSnapshotResponseSchema)(raw),
    ).toThrow();
  });

  it('rejects a response with a missing type field', () => {
    const raw = { flags: [{ key: 'dark-mode', enabled: true, rollout: 0 }] };

    expect(() =>
      Schema.decodeUnknownSync(FlagSnapshotResponseSchema)(raw),
    ).toThrow();
  });

  it('rejects a response with a missing rollout field', () => {
    const raw = {
      flags: [{ key: 'dark-mode', enabled: true, type: 'boolean' }],
    };

    expect(() =>
      Schema.decodeUnknownSync(FlagSnapshotResponseSchema)(raw),
    ).toThrow();
  });
});
