import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ClientNotConnected,
  ConnectFailed,
  createClient,
} from '../../src/index.js';

const makeClient = () =>
  createClient({ apiUrl: 'http://bff:3002', apiKey: 'env_test.secret' });

const makeSuccessfulFetch = (flags: { key: string; enabled: boolean }[]) =>
  vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ flags }),
  });

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

  it('returns true for an active flag in the snapshot', async () => {
    vi.stubGlobal(
      'fetch',
      makeSuccessfulFetch([{ key: 'dark-mode', enabled: true }]),
    );

    const client = makeClient();
    await client.connect();

    expect(client.isEnabled('dark-mode')).toBe(true);
  });

  it('returns false for an inactive flag in the snapshot', async () => {
    vi.stubGlobal(
      'fetch',
      makeSuccessfulFetch([{ key: 'dark-mode', enabled: false }]),
    );

    const client = makeClient();
    await client.connect();

    expect(client.isEnabled('dark-mode')).toBe(false);
  });

  it('returns false for a key absent from the snapshot', async () => {
    vi.stubGlobal(
      'fetch',
      makeSuccessfulFetch([{ key: 'other-flag', enabled: true }]),
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
