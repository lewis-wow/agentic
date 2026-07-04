import { verifyRs256 } from '@repo/auth/jwt';
import type { SystemRole } from '@repo/auth/roles';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import {
  type AuthVariables,
  createTrustedProxyMeAuthMiddleware,
} from '../../src/auth/middleware.js';
import { generateTestKeys, makeUser } from '../helpers/factories.js';

const { privateKey, publicKey } = generateTestKeys();

const EXPECTED_SECRET = 'trusted-proxy-secret';
const OWNER_EMAIL = 'owner@example.com';

const buildApp = (
  upsertUser: ReturnType<typeof vi.fn>,
): Hono<{ Variables: AuthVariables }> => {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use(
    '/me',
    createTrustedProxyMeAuthMiddleware({
      upsertUser,
      privateKeyPem: privateKey,
      expectedSecret: EXPECTED_SECRET,
      designatedOwnerEmail: OWNER_EMAIL,
      identityHeaderName: 'X-Forwarded-Email',
    }),
  );
  app.get('/me', (c) => c.json({ jwt: c.get('jwt'), claims: c.get('claims') }));
  return app;
};

const trustedHeaders = (email: string): Record<string, string> => ({
  'X-Trusted-Proxy-Secret': EXPECTED_SECRET,
  'X-Forwarded-Email': email,
});

describe('trusted proxy me auth middleware', () => {
  it('mints a JWT carrying only userId and systemRole for an owner', async () => {
    const upsertUser = vi
      .fn()
      .mockResolvedValue(
        makeUser({ id: 'owner-1', email: OWNER_EMAIL, role: 'OWNER' }),
      );
    const app = buildApp(upsertUser);

    const res = await app.request('/me', {
      headers: trustedHeaders(OWNER_EMAIL),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claims).toEqual({ userId: 'owner-1', systemRole: 'OWNER' });
    expect(upsertUser).toHaveBeenCalledWith({
      email: OWNER_EMAIL,
      role: 'OWNER' satisfies SystemRole,
    });

    const verified = verifyRs256({ token: body.jwt, publicKeyPem: publicKey });
    expect(verified).toMatchObject({ userId: 'owner-1', systemRole: 'OWNER' });
  });

  it('mints a JWT for a member', async () => {
    const upsertUser = vi.fn().mockResolvedValue(
      makeUser({
        id: 'member-1',
        email: 'member@example.com',
        role: 'MEMBER',
      }),
    );
    const app = buildApp(upsertUser);

    const res = await app.request('/me', {
      headers: trustedHeaders('member@example.com'),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claims).toEqual({ userId: 'member-1', systemRole: 'MEMBER' });
  });

  it('returns 401 when the trusted proxy secret is missing', async () => {
    const upsertUser = vi.fn();
    const app = buildApp(upsertUser);

    const res = await app.request('/me', {
      headers: { 'X-Forwarded-Email': 'member@example.com' },
    });

    expect(res.status).toBe(401);
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it('returns 401 when the identity header is missing', async () => {
    const upsertUser = vi.fn();
    const app = buildApp(upsertUser);

    const res = await app.request('/me', {
      headers: { 'X-Trusted-Proxy-Secret': EXPECTED_SECRET },
    });

    expect(res.status).toBe(401);
    expect(upsertUser).not.toHaveBeenCalled();
  });
});
