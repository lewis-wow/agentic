import { generateApiKey } from '@repo/auth/api-key';
import { verifyRs256 } from '@repo/auth/jwt';
import { Hono } from 'hono';
import { LRUCache } from 'lru-cache';
import { describe, expect, it, vi } from 'vitest';

import {
  type AuthVariables,
  createSdkAuthMiddleware,
} from '../../src/auth/middleware.js';
import { generateTestKeys, makeApiKey } from '../helpers/factories.js';

const { privateKey, publicKey } = generateTestKeys();

const buildApp = (
  findApiKey: ReturnType<typeof vi.fn>,
  cache?: LRUCache<string, string>,
): Hono<{ Variables: AuthVariables }> => {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use(
    '/v1/*',
    createSdkAuthMiddleware({
      findApiKey,
      privateKeyPem: privateKey,
      cache,
    }),
  );
  app.get('/v1/flags', (c) =>
    c.json({ jwt: c.get('jwt'), claims: c.get('claims') }),
  );
  return app;
};

describe('sdk auth middleware', () => {
  it('mints an sdk-client JWT for a valid api key', async () => {
    const { fullKey, apiKeyId, apiKeyHash } = await generateApiKey({
      environmentName: 'production',
    });
    const apiKey = makeApiKey({
      apiKeyHash,
      environmentId: 'env-9',
      environment: { projectId: 'project-9' },
    });
    const findApiKey = vi.fn().mockResolvedValue(apiKey);
    const app = buildApp(findApiKey);

    const res = await app.request('/v1/flags', {
      headers: { Authorization: `Bearer ${fullKey}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claims).toEqual({
      projectId: 'project-9',
      environmentId: 'env-9',
      projectRole: 'sdk-client',
    });
    expect(findApiKey).toHaveBeenCalledWith(apiKeyId);

    const verified = verifyRs256({ token: body.jwt, publicKeyPem: publicKey });
    expect(verified.projectRole).toBe('sdk-client');
    expect((verified as { environmentId: string }).environmentId).toBe('env-9');
  });

  it('returns 401 for a tampered secret', async () => {
    const { fullKey, apiKeyHash } = await generateApiKey({
      environmentName: 'production',
    });
    const apiKey = makeApiKey({ apiKeyHash });
    const findApiKey = vi.fn().mockResolvedValue(apiKey);
    const app = buildApp(findApiKey);

    const tampered = fullKey.slice(0, -4) + 'aaaa';
    const res = await app.request('/v1/flags', {
      headers: { Authorization: `Bearer ${tampered}` },
    });

    expect(res.status).toBe(401);
  });

  it('returns 401 for an unknown apiKeyId', async () => {
    const { fullKey } = await generateApiKey({ environmentName: 'production' });
    const findApiKey = vi.fn().mockResolvedValue(null);
    const app = buildApp(findApiKey);

    const res = await app.request('/v1/flags', {
      headers: { Authorization: `Bearer ${fullKey}` },
    });

    expect(res.status).toBe(401);
  });

  it('returns 401 for a revoked api key, even with a valid secret', async () => {
    const { fullKey, apiKeyHash } = await generateApiKey({
      environmentName: 'production',
    });
    const apiKey = makeApiKey({ apiKeyHash, revokedAt: new Date() });
    const findApiKey = vi.fn().mockResolvedValue(apiKey);
    const app = buildApp(findApiKey);

    const res = await app.request('/v1/flags', {
      headers: { Authorization: `Bearer ${fullKey}` },
    });

    expect(res.status).toBe(401);
  });

  it('rejects immediately once revoked, even if a prior request cached the key', async () => {
    const { fullKey, apiKeyId, apiKeyHash } = await generateApiKey({
      environmentName: 'production',
    });
    const cache = new LRUCache<string, string>({ max: 10, ttl: 60_000 });
    const findApiKey = vi
      .fn()
      .mockResolvedValueOnce(makeApiKey({ apiKeyHash, environmentId: 'env-1' }))
      .mockResolvedValueOnce(
        makeApiKey({
          apiKeyHash,
          environmentId: 'env-1',
          revokedAt: new Date(),
        }),
      );
    const app = buildApp(findApiKey, cache);

    const res1 = await app.request('/v1/flags', {
      headers: { Authorization: `Bearer ${fullKey}` },
    });
    expect(res1.status).toBe(200);
    expect(cache.get(apiKeyId)).toBe('env-1');

    const res2 = await app.request('/v1/flags', {
      headers: { Authorization: `Bearer ${fullKey}` },
    });
    expect(res2.status).toBe(401);
    expect(cache.get(apiKeyId)).toBeUndefined();
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const findApiKey = vi.fn();
    const app = buildApp(findApiKey);

    const res = await app.request('/v1/flags');

    expect(res.status).toBe(401);
    expect(findApiKey).not.toHaveBeenCalled();
  });

  it('returns 401 for a key with no apiKeyId.secret shape, regardless of prefix', async () => {
    const findApiKey = vi.fn();
    const app = buildApp(findApiKey);

    const res = await app.request('/v1/flags', {
      headers: { Authorization: 'Bearer plainoldkey' },
    });

    expect(res.status).toBe(401);
    expect(findApiKey).not.toHaveBeenCalled();
  });

  it('authenticates a key regardless of its cosmetic environment-name prefix', async () => {
    const { fullKey, apiKeyHash } = await generateApiKey({
      environmentName: 'QA Staging',
    });
    expect(fullKey).toMatch(/^qa-staging_/);
    const apiKey = makeApiKey({
      apiKeyHash,
      environmentId: 'env-9',
      environment: { projectId: 'project-9' },
    });
    const findApiKey = vi.fn().mockResolvedValue(apiKey);
    const app = buildApp(findApiKey);

    const res = await app.request('/v1/flags', {
      headers: { Authorization: `Bearer ${fullKey}` },
    });

    expect(res.status).toBe(200);
  });

  it('authenticates a key with no prefix at all', async () => {
    const { fullKey, apiKeyHash } = await generateApiKey({
      environmentName: '!!!',
    });
    expect(fullKey).toMatch(/^[0-9a-f]{32}\./);
    const apiKey = makeApiKey({
      apiKeyHash,
      environmentId: 'env-9',
      environment: { projectId: 'project-9' },
    });
    const findApiKey = vi.fn().mockResolvedValue(apiKey);
    const app = buildApp(findApiKey);

    const res = await app.request('/v1/flags', {
      headers: { Authorization: `Bearer ${fullKey}` },
    });

    expect(res.status).toBe(200);
  });

  it('uses the LRU cache on the second request, skipping bcrypt', async () => {
    const { fullKey, apiKeyId, apiKeyHash } = await generateApiKey({
      environmentName: 'production',
    });
    const apiKey = makeApiKey({
      apiKeyHash,
      environmentId: 'env-cached',
      environment: { projectId: 'project-cached' },
    });
    const findApiKey = vi.fn().mockResolvedValue(apiKey);
    const cache = new LRUCache<string, string>({ max: 10, ttl: 60_000 });
    const app = buildApp(findApiKey, cache);

    // First request: cache miss → bcrypt.compare runs, result cached.
    const res1 = await app.request('/v1/flags', {
      headers: { Authorization: `Bearer ${fullKey}` },
    });
    expect(res1.status).toBe(200);

    // Second request: cache hit → findApiKey called again (to catch
    // revocation) but no bcrypt; cache still holds environmentId.
    const res2 = await app.request('/v1/flags', {
      headers: { Authorization: `Bearer ${fullKey}` },
    });
    expect(res2.status).toBe(200);
    expect(findApiKey).toHaveBeenCalledTimes(2);
    expect(cache.get(apiKeyId)).toBe('env-cached');
  });
});
