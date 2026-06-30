import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ClientNotConnected,
  ConnectFailed,
  createClient,
} from '../../src/index.js';

const makeClient = () =>
  createClient({ apiUrl: 'http://bff:3002', apiKey: 'env_test.secret' });

const makeSuccessfulFetch = (
  flags: { key: string; enabled: boolean; type: string; rollout: number }[],
) =>
  vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ flags }),
  });

const computeBucket = (flagKey: string, userId: string): number => {
  const hash = createHash('sha256').update(`${flagKey}/${userId}`).digest();
  return hash.readUInt32BE(0) % 100;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isEnabled()', () => {
  it('throws ClientNotConnected before connect() is called', () => {
    const client = makeClient();

    expect(() => client.isEnabled('some-flag')).toThrow(ClientNotConnected);
  });
});

describe('connect()', () => {
  it('throws ConnectFailed when the server returns a non-200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );

    const client = makeClient();

    await expect(client.connect()).rejects.toThrow(ConnectFailed);
  });

  it('throws ConnectFailed when fetch itself throws (network error)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network error')),
    );

    const client = makeClient();

    await expect(client.connect()).rejects.toThrow(ConnectFailed);
  });

  it('returns true for an active boolean flag in the snapshot', async () => {
    vi.stubGlobal(
      'fetch',
      makeSuccessfulFetch([
        { key: 'dark-mode', enabled: true, type: 'boolean', rollout: 0 },
      ]),
    );

    const client = makeClient();
    await client.connect();

    expect(client.isEnabled('dark-mode')).toBe(true);
  });

  it('returns false for an inactive boolean flag in the snapshot', async () => {
    vi.stubGlobal(
      'fetch',
      makeSuccessfulFetch([
        { key: 'dark-mode', enabled: false, type: 'boolean', rollout: 0 },
      ]),
    );

    const client = makeClient();
    await client.connect();

    expect(client.isEnabled('dark-mode')).toBe(false);
  });

  it('returns false for a key absent from the snapshot', async () => {
    vi.stubGlobal(
      'fetch',
      makeSuccessfulFetch([
        { key: 'other-flag', enabled: true, type: 'boolean', rollout: 0 },
      ]),
    );

    const client = makeClient();
    await client.connect();

    expect(client.isEnabled('unknown')).toBe(false);
  });

  it('throws when connect() receives malformed JSON (Effect Schema decode error)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ not: 'a valid snapshot' }),
      }),
    );

    const client = makeClient();

    await expect(client.connect()).rejects.toThrow();
  });
});

describe('isEnabled() — boolean flag', () => {
  it('returns enabled regardless of context (no userId needed)', async () => {
    vi.stubGlobal(
      'fetch',
      makeSuccessfulFetch([
        { key: 'my-flag', enabled: true, type: 'boolean', rollout: 0 },
      ]),
    );

    const client = makeClient();
    await client.connect();

    expect(client.isEnabled('my-flag')).toBe(true);
    expect(client.isEnabled('my-flag', {})).toBe(true);
    expect(client.isEnabled('my-flag', { userId: 'user-1' })).toBe(true);
  });

  it('returns false when enabled is false, regardless of context', async () => {
    vi.stubGlobal(
      'fetch',
      makeSuccessfulFetch([
        { key: 'my-flag', enabled: false, type: 'boolean', rollout: 0 },
      ]),
    );

    const client = makeClient();
    await client.connect();

    expect(client.isEnabled('my-flag', { userId: 'user-1' })).toBe(false);
  });
});

describe('isEnabled() — percentage_rollout flag', () => {
  // bucket('rollout-flag', 'user-0') = 15  → inside rollout=50
  // bucket('rollout-flag', 'user-1') = 94  → outside rollout=50

  it('returns true when user bucket is below the rollout percentage', async () => {
    vi.stubGlobal(
      'fetch',
      makeSuccessfulFetch([
        {
          key: 'rollout-flag',
          enabled: true,
          type: 'percentage_rollout',
          rollout: 50,
        },
      ]),
    );

    const client = makeClient();
    await client.connect();

    // user-0 has bucket 15 < 50
    expect(computeBucket('rollout-flag', 'user-0')).toBe(15);
    expect(client.isEnabled('rollout-flag', { userId: 'user-0' })).toBe(true);
  });

  it('returns false when user bucket is at or above the rollout percentage', async () => {
    vi.stubGlobal(
      'fetch',
      makeSuccessfulFetch([
        {
          key: 'rollout-flag',
          enabled: true,
          type: 'percentage_rollout',
          rollout: 50,
        },
      ]),
    );

    const client = makeClient();
    await client.connect();

    // user-1 has bucket 94 >= 50
    expect(computeBucket('rollout-flag', 'user-1')).toBe(94);
    expect(client.isEnabled('rollout-flag', { userId: 'user-1' })).toBe(false);
  });

  it('rollout=0 → always false for any user', async () => {
    vi.stubGlobal(
      'fetch',
      makeSuccessfulFetch([
        {
          key: 'rollout-flag',
          enabled: true,
          type: 'percentage_rollout',
          rollout: 0,
        },
      ]),
    );

    const client = makeClient();
    await client.connect();

    expect(client.isEnabled('rollout-flag', { userId: 'user-0' })).toBe(false);
    expect(client.isEnabled('rollout-flag', { userId: 'user-1' })).toBe(false);
    expect(client.isEnabled('rollout-flag', { userId: 'user-999' })).toBe(
      false,
    );
  });

  it('rollout=100 → always true for any user (bucket is always 0–99)', async () => {
    vi.stubGlobal(
      'fetch',
      makeSuccessfulFetch([
        {
          key: 'rollout-flag',
          enabled: true,
          type: 'percentage_rollout',
          rollout: 100,
        },
      ]),
    );

    const client = makeClient();
    await client.connect();

    expect(client.isEnabled('rollout-flag', { userId: 'user-0' })).toBe(true);
    expect(client.isEnabled('rollout-flag', { userId: 'user-1' })).toBe(true);
    expect(client.isEnabled('rollout-flag', { userId: 'user-999' })).toBe(true);
  });

  it('returns false when userId is absent from context', async () => {
    vi.stubGlobal(
      'fetch',
      makeSuccessfulFetch([
        {
          key: 'rollout-flag',
          enabled: true,
          type: 'percentage_rollout',
          rollout: 50,
        },
      ]),
    );

    const client = makeClient();
    await client.connect();

    expect(client.isEnabled('rollout-flag')).toBe(false);
  });

  it('returns false for empty context object (no userId key)', async () => {
    vi.stubGlobal(
      'fetch',
      makeSuccessfulFetch([
        {
          key: 'rollout-flag',
          enabled: true,
          type: 'percentage_rollout',
          rollout: 50,
        },
      ]),
    );

    const client = makeClient();
    await client.connect();

    expect(client.isEnabled('rollout-flag', {})).toBe(false);
  });

  it('returns false when flag is disabled regardless of user bucket', async () => {
    vi.stubGlobal(
      'fetch',
      makeSuccessfulFetch([
        {
          key: 'rollout-flag',
          enabled: false,
          type: 'percentage_rollout',
          rollout: 100,
        },
      ]),
    );

    const client = makeClient();
    await client.connect();

    expect(client.isEnabled('rollout-flag', { userId: 'user-0' })).toBe(false);
  });

  it('sticky bucketing — same (flagKey, userId) always produces the same result', async () => {
    vi.stubGlobal(
      'fetch',
      makeSuccessfulFetch([
        {
          key: 'rollout-flag',
          enabled: true,
          type: 'percentage_rollout',
          rollout: 50,
        },
      ]),
    );

    const client = makeClient();
    await client.connect();

    const first = client.isEnabled('rollout-flag', { userId: 'user-0' });
    const second = client.isEnabled('rollout-flag', { userId: 'user-0' });
    expect(first).toBe(second);
  });
});
