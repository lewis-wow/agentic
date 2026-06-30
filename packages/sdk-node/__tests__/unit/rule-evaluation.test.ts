import { afterEach, describe, expect, it, vi } from 'vitest';

import { createClient } from '../../src/index.js';

const makeClientWithFlag = (flag: {
  key: string;
  enabled: boolean;
  type: string;
  rollout: number;
  rules: { attribute: string; operator: string; value: string[] }[];
}) => {
  const client = createClient({ apiUrl: 'http://api', apiKey: 'key' });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ flags: [flag] }),
    }),
  );
  return client;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('targeted evaluation — shared edge cases', () => {
  it('flag with empty rules returns false', async () => {
    const client = makeClientWithFlag({
      key: 'beta',
      enabled: true,
      type: 'targeted',
      rollout: 0,
      rules: [],
    });
    await client.connect();

    expect(client.isEnabled('beta', { plan: 'pro' })).toBe(false);
  });

  it('flag with enabled:false returns false regardless of rules', async () => {
    const client = makeClientWithFlag({
      key: 'beta',
      enabled: false,
      type: 'targeted',
      rollout: 0,
      rules: [{ attribute: 'plan', operator: 'EQ', value: ['pro'] }],
    });
    await client.connect();

    expect(client.isEnabled('beta', { plan: 'pro' })).toBe(false);
  });

  it('missing context attribute causes rule to fail → false', async () => {
    const client = makeClientWithFlag({
      key: 'beta',
      enabled: true,
      type: 'targeted',
      rollout: 0,
      rules: [{ attribute: 'plan', operator: 'EQ', value: ['pro'] }],
    });
    await client.connect();

    expect(client.isEnabled('beta', { userId: 'u1' })).toBe(false);
  });

  it('no context arg at all → false', async () => {
    const client = makeClientWithFlag({
      key: 'beta',
      enabled: true,
      type: 'targeted',
      rollout: 0,
      rules: [{ attribute: 'plan', operator: 'EQ', value: ['pro'] }],
    });
    await client.connect();

    expect(client.isEnabled('beta')).toBe(false);
  });
});

describe('EQ', () => {
  it('matching value → true', async () => {
    const client = makeClientWithFlag({
      key: 'beta',
      enabled: true,
      type: 'targeted',
      rollout: 0,
      rules: [{ attribute: 'plan', operator: 'EQ', value: ['pro'] }],
    });
    await client.connect();

    expect(client.isEnabled('beta', { plan: 'pro' })).toBe(true);
  });

  it('non-matching value → false', async () => {
    const client = makeClientWithFlag({
      key: 'beta',
      enabled: true,
      type: 'targeted',
      rollout: 0,
      rules: [{ attribute: 'plan', operator: 'EQ', value: ['pro'] }],
    });
    await client.connect();

    expect(client.isEnabled('beta', { plan: 'free' })).toBe(false);
  });
});

describe('NEQ', () => {
  it('non-matching value → true', async () => {
    const client = makeClientWithFlag({
      key: 'beta',
      enabled: true,
      type: 'targeted',
      rollout: 0,
      rules: [{ attribute: 'plan', operator: 'NEQ', value: ['free'] }],
    });
    await client.connect();

    expect(client.isEnabled('beta', { plan: 'pro' })).toBe(true);
  });

  it('matching value → false', async () => {
    const client = makeClientWithFlag({
      key: 'beta',
      enabled: true,
      type: 'targeted',
      rollout: 0,
      rules: [{ attribute: 'plan', operator: 'NEQ', value: ['free'] }],
    });
    await client.connect();

    expect(client.isEnabled('beta', { plan: 'free' })).toBe(false);
  });
});

describe('IN', () => {
  it('context value in list → true', async () => {
    const client = makeClientWithFlag({
      key: 'beta',
      enabled: true,
      type: 'targeted',
      rollout: 0,
      rules: [{ attribute: 'country', operator: 'IN', value: ['US', 'CA'] }],
    });
    await client.connect();

    expect(client.isEnabled('beta', { country: 'US' })).toBe(true);
  });

  it('context value not in list → false', async () => {
    const client = makeClientWithFlag({
      key: 'beta',
      enabled: true,
      type: 'targeted',
      rollout: 0,
      rules: [{ attribute: 'country', operator: 'IN', value: ['US', 'CA'] }],
    });
    await client.connect();

    expect(client.isEnabled('beta', { country: 'GB' })).toBe(false);
  });

  it('empty value array → false', async () => {
    const client = makeClientWithFlag({
      key: 'beta',
      enabled: true,
      type: 'targeted',
      rollout: 0,
      rules: [{ attribute: 'country', operator: 'IN', value: [] }],
    });
    await client.connect();

    expect(client.isEnabled('beta', { country: 'US' })).toBe(false);
  });
});

describe('NOT_IN', () => {
  it('context value not in list → true', async () => {
    const client = makeClientWithFlag({
      key: 'beta',
      enabled: true,
      type: 'targeted',
      rollout: 0,
      rules: [
        { attribute: 'country', operator: 'NOT_IN', value: ['CN', 'RU'] },
      ],
    });
    await client.connect();

    expect(client.isEnabled('beta', { country: 'US' })).toBe(true);
  });

  it('context value in list → false', async () => {
    const client = makeClientWithFlag({
      key: 'beta',
      enabled: true,
      type: 'targeted',
      rollout: 0,
      rules: [
        { attribute: 'country', operator: 'NOT_IN', value: ['CN', 'RU'] },
      ],
    });
    await client.connect();

    expect(client.isEnabled('beta', { country: 'CN' })).toBe(false);
  });
});

describe('CONTAINS', () => {
  it('needle present in context value → true', async () => {
    const client = makeClientWithFlag({
      key: 'beta',
      enabled: true,
      type: 'targeted',
      rollout: 0,
      rules: [{ attribute: 'email', operator: 'CONTAINS', value: ['@acme'] }],
    });
    await client.connect();

    expect(client.isEnabled('beta', { email: 'alice@acme.com' })).toBe(true);
  });

  it('needle absent → false', async () => {
    const client = makeClientWithFlag({
      key: 'beta',
      enabled: true,
      type: 'targeted',
      rollout: 0,
      rules: [{ attribute: 'email', operator: 'CONTAINS', value: ['@acme'] }],
    });
    await client.connect();

    expect(client.isEnabled('beta', { email: 'bob@other.com' })).toBe(false);
  });

  it('case-sensitive: uppercase needle in lowercase string → false', async () => {
    const client = makeClientWithFlag({
      key: 'beta',
      enabled: true,
      type: 'targeted',
      rollout: 0,
      rules: [{ attribute: 'email', operator: 'CONTAINS', value: ['@ACME'] }],
    });
    await client.connect();

    expect(client.isEnabled('beta', { email: 'alice@acme.com' })).toBe(false);
  });

  it('empty needle (value[0] = "") → true (all strings contain "")', async () => {
    const client = makeClientWithFlag({
      key: 'beta',
      enabled: true,
      type: 'targeted',
      rollout: 0,
      rules: [{ attribute: 'email', operator: 'CONTAINS', value: [''] }],
    });
    await client.connect();

    expect(client.isEnabled('beta', { email: 'alice@acme.com' })).toBe(true);
  });
});

describe('AND semantics — all rules must match', () => {
  it('both rules match → true', async () => {
    const client = makeClientWithFlag({
      key: 'beta',
      enabled: true,
      type: 'targeted',
      rollout: 0,
      rules: [
        { attribute: 'plan', operator: 'EQ', value: ['pro'] },
        { attribute: 'country', operator: 'IN', value: ['US', 'CA'] },
      ],
    });
    await client.connect();

    expect(client.isEnabled('beta', { plan: 'pro', country: 'US' })).toBe(true);
  });

  it('first rule matches but second fails → false', async () => {
    const client = makeClientWithFlag({
      key: 'beta',
      enabled: true,
      type: 'targeted',
      rollout: 0,
      rules: [
        { attribute: 'plan', operator: 'EQ', value: ['pro'] },
        { attribute: 'country', operator: 'IN', value: ['US', 'CA'] },
      ],
    });
    await client.connect();

    expect(client.isEnabled('beta', { plan: 'pro', country: 'GB' })).toBe(
      false,
    );
  });
});
