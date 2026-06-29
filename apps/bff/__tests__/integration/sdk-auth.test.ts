import { verifyRs256 } from '@repo/auth/jwt';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import {
  type AuthVariables,
  createSdkAuthMiddleware,
} from '../../src/auth/middleware.js';
import { generateTestKeys, makeEnvironment } from '../helpers/factories.js';

const { privateKey, publicKey } = generateTestKeys();

const buildApp = (
  findEnvironment: ReturnType<typeof vi.fn>,
): Hono<{ Variables: AuthVariables }> => {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use(
    '/sdk/*',
    createSdkAuthMiddleware({ findEnvironment, privateKeyPem: privateKey }),
  );
  app.get('/sdk/flags', (c) =>
    c.json({ jwt: c.get('jwt'), claims: c.get('claims') }),
  );
  return app;
};

describe('sdk auth middleware', () => {
  it('mints an sdk-client JWT for a valid environment api key', async () => {
    const findEnvironment = vi.fn().mockResolvedValue(
      makeEnvironment({
        id: 'env-9',
        projectId: 'project-9',
        apiKey: 'secret-key',
      }),
    );
    const app = buildApp(findEnvironment);

    const res = await app.request('/sdk/flags', {
      headers: { Authorization: 'Bearer secret-key' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claims).toEqual({
      projectId: 'project-9',
      environmentId: 'env-9',
      projectRole: 'sdk-client',
    });
    expect(findEnvironment).toHaveBeenCalledWith('secret-key');

    // The minted token verifies with the matching public key (what apps/api does).
    const verified = verifyRs256({ token: body.jwt, publicKeyPem: publicKey });
    expect(verified.projectRole).toBe('sdk-client');
    expect(verified.environmentId).toBe('env-9');
  });

  it('returns 401 for an unknown api key', async () => {
    const findEnvironment = vi.fn().mockResolvedValue(null);
    const app = buildApp(findEnvironment);

    const res = await app.request('/sdk/flags', {
      headers: { Authorization: 'Bearer nope' },
    });

    expect(res.status).toBe(401);
  });

  it('returns 401 when no api key is provided', async () => {
    const findEnvironment = vi.fn();
    const app = buildApp(findEnvironment);

    const res = await app.request('/sdk/flags');

    expect(res.status).toBe(401);
    expect(findEnvironment).not.toHaveBeenCalled();
  });
});
