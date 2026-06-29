import { signRs256 } from '@repo/auth/jwt';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import {
  type ApiAuthVariables,
  createJwtVerifyMiddleware,
} from '../../src/auth/middleware.js';
import { generateTestKeys } from '../helpers/keys.js';

const { privateKey, publicKey } = generateTestKeys();

const buildApp = (): Hono<{ Variables: ApiAuthVariables }> => {
  const app = new Hono<{ Variables: ApiAuthVariables }>();
  app.use('/me', createJwtVerifyMiddleware({ publicKeyPem: publicKey }));
  app.use('/sdk/*', createJwtVerifyMiddleware({ publicKeyPem: publicKey }));
  app.get('/me', (c) => c.json({ auth: c.get('auth') }));
  app.get('/sdk/flags', (c) => {
    const auth = c.get('auth');
    const isSdk = 'projectRole' in auth && auth.projectRole === 'sdk-client';
    return c.json({ isSdk, auth });
  });
  return app;
};

const bearer = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
});

describe('api jwt verify middleware', () => {
  it('accepts a valid token and injects claims into context', async () => {
    const token = signRs256({
      payload: { userId: 'u1', systemRole: 'OWNER' },
      privateKeyPem: privateKey,
      expiresInSeconds: 60,
    });

    const res = await buildApp().request('/me', { headers: bearer(token) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.auth).toMatchObject({ userId: 'u1', systemRole: 'OWNER' });
  });

  it('distinguishes the sdk-client role', async () => {
    const token = signRs256({
      payload: {
        projectId: 'p1',
        environmentId: 'e1',
        projectRole: 'sdk-client',
      },
      privateKeyPem: privateKey,
      expiresInSeconds: 60,
    });

    const res = await buildApp().request('/sdk/flags', {
      headers: bearer(token),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isSdk).toBe(true);
  });

  it('rejects a missing token with 401', async () => {
    const res = await buildApp().request('/me');
    expect(res.status).toBe(401);
  });

  it('rejects a token signed by a different key with 401', async () => {
    const other = generateTestKeys();
    const token = signRs256({
      payload: { userId: 'u1', systemRole: 'OWNER' },
      privateKeyPem: other.privateKey,
      expiresInSeconds: 60,
    });

    const res = await buildApp().request('/me', { headers: bearer(token) });
    expect(res.status).toBe(401);
  });

  it('rejects an expired token with 401', async () => {
    const token = signRs256({
      payload: { userId: 'u1', systemRole: 'OWNER' },
      privateKeyPem: privateKey,
      expiresInSeconds: -10,
    });

    const res = await buildApp().request('/me', { headers: bearer(token) });
    expect(res.status).toBe(401);
  });
});
