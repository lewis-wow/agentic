import { generateApiKey, verifyApiKey } from '@repo/auth/api-key';
import { describe, expect, it } from 'vitest';

describe('generateApiKey', () => {
  it('prefixes the key with the slugified environment name', async () => {
    const { fullKey, apiKeyId, apiKeyHash } = await generateApiKey({
      environmentName: 'production',
    });
    expect(fullKey).toMatch(/^production_[0-9a-f]{32}\.[0-9a-f]{64}$/);
    expect(fullKey).toContain(apiKeyId);
    expect(apiKeyHash).toBeTruthy();
  });

  it('slugifies a multi-word environment name into a kebab-case prefix', async () => {
    const { fullKey } = await generateApiKey({
      environmentName: 'QA Staging',
    });
    expect(fullKey).toMatch(/^qa-staging_[0-9a-f]{32}\.[0-9a-f]{64}$/);
  });

  it('omits the prefix segment when the environment name slugifies to empty', async () => {
    const { fullKey } = await generateApiKey({ environmentName: '!!!' });
    expect(fullKey).toMatch(/^[0-9a-f]{32}\.[0-9a-f]{64}$/);
  });

  it('produces unique keys on each call', async () => {
    const a = await generateApiKey({ environmentName: 'production' });
    const b = await generateApiKey({ environmentName: 'production' });
    expect(a.fullKey).not.toBe(b.fullKey);
    expect(a.apiKeyId).not.toBe(b.apiKeyId);
  });
});

describe('verifyApiKey', () => {
  it('returns true for a valid key', async () => {
    const { fullKey, apiKeyHash } = await generateApiKey({
      environmentName: 'production',
    });
    await expect(verifyApiKey({ fullKey, apiKeyHash })).resolves.toBe(true);
  });

  it('returns false for a tampered secret', async () => {
    const { fullKey, apiKeyHash } = await generateApiKey({
      environmentName: 'production',
    });
    const tampered = fullKey.slice(0, -4) + 'aaaa';
    await expect(verifyApiKey({ fullKey: tampered, apiKeyHash })).resolves.toBe(
      false,
    );
  });

  it('returns false for a malformed key with no dot', async () => {
    const { apiKeyHash } = await generateApiKey({
      environmentName: 'production',
    });
    await expect(
      verifyApiKey({ fullKey: 'nodothere', apiKeyHash }),
    ).resolves.toBe(false);
  });
});
