import { generateApiKey, verifyApiKey } from '@repo/auth/api-key';
import { describe, expect, it } from 'vitest';

describe('generateApiKey', () => {
  it('returns a key in env_<apiKeyId>.<secret> format', async () => {
    const { fullKey, apiKeyId, apiKeyHash } = await generateApiKey();
    expect(fullKey).toMatch(/^env_[0-9a-f]{32}\.[0-9a-f]{64}$/);
    expect(fullKey).toContain(apiKeyId);
    expect(apiKeyHash).toBeTruthy();
  });

  it('produces unique keys on each call', async () => {
    const a = await generateApiKey();
    const b = await generateApiKey();
    expect(a.fullKey).not.toBe(b.fullKey);
    expect(a.apiKeyId).not.toBe(b.apiKeyId);
  });
});

describe('verifyApiKey', () => {
  it('returns true for a valid key', async () => {
    const { fullKey, apiKeyHash } = await generateApiKey();
    await expect(verifyApiKey({ fullKey, apiKeyHash })).resolves.toBe(true);
  });

  it('returns false for a tampered secret', async () => {
    const { fullKey, apiKeyHash } = await generateApiKey();
    const tampered = fullKey.slice(0, -4) + 'aaaa';
    await expect(verifyApiKey({ fullKey: tampered, apiKeyHash })).resolves.toBe(
      false,
    );
  });

  it('returns false for a malformed key with no dot', async () => {
    const { apiKeyHash } = await generateApiKey();
    await expect(
      verifyApiKey({ fullKey: 'nodothere', apiKeyHash }),
    ).resolves.toBe(false);
  });
});
