import { verifyRs256 } from '@repo/auth/jwt';
import type { SystemRole } from '@repo/auth/roles';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import {
  type AuthVariables,
  createTrustedProxyProjectAuthMiddleware,
} from '../../src/auth/middleware.js';
import { generateTestKeys, makeUser } from '../helpers/factories.js';

const { privateKey, publicKey } = generateTestKeys();

const EXPECTED_SECRET = 'trusted-proxy-secret';
const OWNER_EMAIL = 'owner@example.com';

type AppDeps = {
  upsertUser: ReturnType<typeof vi.fn>;
};

const buildApp = (deps: AppDeps): Hono<{ Variables: AuthVariables }> => {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use(
    '/projects/:projectId/*',
    createTrustedProxyProjectAuthMiddleware({
      upsertUser: deps.upsertUser,
      privateKeyPem: privateKey,
      expectedSecret: EXPECTED_SECRET,
      designatedOwnerEmail: OWNER_EMAIL,
      identityHeaderName: 'X-Forwarded-Email',
    }),
  );
  app.get('/projects/:projectId/flags', (c) =>
    c.json({ jwt: c.get('jwt'), claims: c.get('claims') }),
  );
  return app;
};

const trustedHeaders = (email: string): Record<string, string> => ({
  'X-Trusted-Proxy-Secret': EXPECTED_SECRET,
  'X-Forwarded-Email': email,
});

describe('trusted proxy project auth middleware', () => {
  it('mints an owner JWT', async () => {
    const upsertUser = vi
      .fn()
      .mockResolvedValue(
        makeUser({ id: 'owner-1', email: OWNER_EMAIL, role: 'OWNER' }),
      );
    const app = buildApp({ upsertUser });

    const res = await app.request('/projects/project-1/flags', {
      headers: trustedHeaders(OWNER_EMAIL),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claims).toMatchObject({
      userId: 'owner-1',
      systemRole: 'OWNER',
      projectId: 'project-1',
      projectRole: 'owner',
    });
    expect(upsertUser).toHaveBeenCalledWith({
      email: OWNER_EMAIL,
      role: 'OWNER' satisfies SystemRole,
    });

    const verified = verifyRs256({ token: body.jwt, publicKeyPem: publicKey });
    expect(verified.projectRole).toBe('owner');
  });

  it('returns 403 for a non-owner — project access is owner-only', async () => {
    const upsertUser = vi
      .fn()
      .mockResolvedValue(
        makeUser({ email: 'member@example.com', role: 'MEMBER' }),
      );
    const app = buildApp({ upsertUser });

    const res = await app.request('/projects/project-1/flags', {
      headers: trustedHeaders('member@example.com'),
    });

    expect(res.status).toBe(403);
  });

  it('returns 401 when the trusted proxy secret is missing', async () => {
    const upsertUser = vi.fn();
    const app = buildApp({ upsertUser });

    const res = await app.request('/projects/project-1/flags', {
      headers: { 'X-Forwarded-Email': 'member@example.com' },
    });

    expect(res.status).toBe(401);
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it('returns 401 when the trusted proxy secret does not match', async () => {
    const upsertUser = vi.fn();
    const app = buildApp({ upsertUser });

    const res = await app.request('/projects/project-1/flags', {
      headers: {
        'X-Trusted-Proxy-Secret': 'wrong-secret',
        'X-Forwarded-Email': 'member@example.com',
      },
    });

    expect(res.status).toBe(401);
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it('returns 401 when the identity header is missing', async () => {
    const upsertUser = vi.fn();
    const app = buildApp({ upsertUser });

    const res = await app.request('/projects/project-1/flags', {
      headers: { 'X-Trusted-Proxy-Secret': EXPECTED_SECRET },
    });

    expect(res.status).toBe(401);
    expect(upsertUser).not.toHaveBeenCalled();
  });
});
