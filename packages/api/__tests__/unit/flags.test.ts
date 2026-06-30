import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { FlagSnapshotResponseSchema } from '../../src/index.js';

describe('FlagSnapshotResponseSchema', () => {
  it('decodes a valid snapshot response', () => {
    const raw = {
      flags: [
        { key: 'dark-mode', enabled: true },
        { key: 'new-onboarding', enabled: false },
      ],
    };

    const result = Schema.decodeUnknownSync(FlagSnapshotResponseSchema)(raw);

    expect(result).toEqual(raw);
  });

  it('rejects a response with a missing enabled field', () => {
    const raw = { flags: [{ key: 'dark-mode' }] };

    expect(() =>
      Schema.decodeUnknownSync(FlagSnapshotResponseSchema)(raw),
    ).toThrow();
  });

  it('rejects a response with a non-boolean enabled', () => {
    const raw = { flags: [{ key: 'dark-mode', enabled: 'yes' }] };

    expect(() =>
      Schema.decodeUnknownSync(FlagSnapshotResponseSchema)(raw),
    ).toThrow();
  });
});
