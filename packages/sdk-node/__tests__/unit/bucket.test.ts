import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { bucket } from '../../src/bucket.js';

describe('bucket()', () => {
  it('returns an integer in [0, 99] for arbitrary inputs', () => {
    const result = bucket('my-flag', 'user-123');
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(99);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('is deterministic — same inputs always produce the same bucket', () => {
    expect(bucket('my-flag', 'user-abc')).toBe(bucket('my-flag', 'user-abc'));
  });

  it('produces correct value: sha256(flagKey/userId) first 4 bytes big-endian uint32 mod 100', () => {
    const flagKey = 'dark-mode';
    const userId = 'alice';
    const hash = createHash('sha256').update(`${flagKey}/${userId}`).digest();
    const expected = hash.readUInt32BE(0) % 100;
    expect(bucket(flagKey, userId)).toBe(expected);
  });

  it('different users get different buckets (statistical, not guaranteed — uses deterministic pair)', () => {
    const a = bucket('rollout-flag', 'user-A');
    const b = bucket('rollout-flag', 'user-ZZZZZZ');
    // These specific inputs produce different values by inspection
    expect(a).not.toBe(b);
  });

  it('different flag keys produce different buckets for the same user', () => {
    const a = bucket('flag-alpha', 'user-1');
    const b = bucket('flag-beta', 'user-1');
    expect(a).not.toBe(b);
  });
});
