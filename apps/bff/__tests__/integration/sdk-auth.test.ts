import { generateApiKey } from '@repo/auth/api-key';
import { verifyRs256 } from '@repo/auth/jwt';
import { Hono } from 'hono';
import { LRUCache } from 'lru-cache';
import { describe, expect, it, vi } from 'vitest';

import {
  type AuthVariables,
  createSdkAuthMiddleware,
} from '../../src/auth/middleware.js';
import { generateTestKeys, makeEnvironment } from '../helpers/factories.js';

const { privateKey, publicKey } = generateTestKeys();

const buildApp = (
  findEnvironment: ReturnType<typeof vi.fn>,
  cache?: LRUCache<string, string>,
): Hono<{ Variables: AuthVariables }> => {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use(
    '/sdk/*',
    createSdkAuthMiddleware({
      findEnvironment,
      privateKeyPem: privateKey,
      cache,
    }),
  );
  app.get('/sdk/flags', (c) =>
    c.json({ jwt: c.get('jwt'), claims: c.get('claims') }),
  );
  return app;
};

describe('sdk auth middleware', () => {
  it('mints an sdk-client JWT for a valid api key', async () => {
    const { fullKey, apiKeyId, apiKeyHash } = await generateApiKey();
    const environment = makeEnvironment({
      id: 'env-9',
      projectId: 'project-9',
      apiKeyId,
      apiKeyHash,
    });
    const findEnvironment = vi.fn().mockResolvedValue(environment);
    const app = buildApp(findEnvironment);

    const res = await app.request('/sdk/flags', {
      headers: { Authorization: `Bearer ${fullKey}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claims).toEqual({
      projectId: 'project-9',
      environmentId: 'env-9',
      projectRole: 'sdk-client',
    });
    expect(findEnvironment).toHaveBeenCalledWith(apiKeyId);

    const verified = verifyRs256({ token: body.jwt, publicKeyPem: publicKey });
    expect(verified.projectRole).toBe('sdk-client');
    expect((verified as { environmentId: string }).environmentId).toBe('env-9');
  });

  it('returns 401 for a tampered secret', async () => {
    const { fullKey, apiKeyId, apiKeyHash } = await generateApiKey();
    const environment = makeEnvironment({ apiKeyId, apiKeyHash });
    const findEnvironment = vi.fn().mockResolvedValue(environment);
    const app = buildApp(findEnvironment);

    const tampered = fullKey.slice(0, -4) + 'aaaa';
    const res = await app.request('/sdk/flags', {
      headers: { Authorization: `Bearer ${tampered}` },
    });

    expect(res.status).toBe(401);
  });

  it('returns 401 for an unknown apiKeyId', async () => {
    const { fullKey } = await generateApiKey();
    const findEnvironment = vi.fn().mockResolvedValue(null);
    const app = buildApp(findEnvironment);

    const res = await app.request('/sdk/flags', {
      headers: { Authorization: `Bearer ${fullKey}` },
    });

    expect(res.status).toBe(401);
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const findEnvironment = vi.fn();
    const app = buildApp(findEnvironment);

    const res = await app.request('/sdk/flags');

    expect(res.status).toBe(401);
    expect(findEnvironment).not.toHaveBeenCalled();
  });

  it('returns 401 for a key without the env_ prefix', async () => {
    const findEnvironment = vi.fn();
    const app = buildApp(findEnvironment);

    const res = await app.request('/sdk/flags', {
      headers: { Authorization: 'Bearer plainoldkey' },
    });

    expect(res.status).toBe(401);
    expect(findEnvironment).not.toHaveBeenCalled();
  });

  it('uses the LRU cache on the second request, skipping bcrypt', async () => {
    const { fullKey, apiKeyId, apiKeyHash } = await generateApiKey();
    const environment = makeEnvironment({
      id: 'env-cached',
      projectId: 'project-cached',
      apiKeyId,
      apiKeyHash,
    });
    const findEnvironment = vi.fn().mockResolvedValue(environment);
    const cache = new LRUCache<string, string>({ max: 10, ttl: 60_000 });
    const app = buildApp(findEnvironment, cache);

    // First request: cache miss → bcrypt.compare runs, result cached.
    const res1 = await app.request('/sdk/flags', {
      headers: { Authorization: `Bearer ${fullKey}` },
    });
    expect(res1.status).toBe(200);

    // Second request: cache hit → findEnvironment called again for projectId but
    // no bcrypt; cache now holds environmentId.
    const res2 = await app.request('/sdk/flags', {
      headers: { Authorization: `Bearer ${fullKey}` },
    });
    expect(res2.status).toBe(200);
    expect(findEnvironment).toHaveBeenCalledTimes(2);
    expect(cache.get(apiKeyId)).toBe('env-cached');
  });
});
