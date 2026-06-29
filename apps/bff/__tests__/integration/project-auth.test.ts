import { verifyRs256 } from '@repo/auth/jwt';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import {
  type AuthVariables,
  createProjectAuthMiddleware,
  SESSION_COOKIE,
} from '../../src/auth/middleware.js';
import {
  generateTestKeys,
  makeMembership,
  makeSession,
  makeUser,
} from '../helpers/factories.js';

const { privateKey, publicKey } = generateTestKeys();

type AppDeps = {
  findSession: ReturnType<typeof vi.fn>;
  findMembership: ReturnType<typeof vi.fn>;
};

const buildApp = (deps: AppDeps): Hono<{ Variables: AuthVariables }> => {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use(
    '/projects/:projectId/*',
    createProjectAuthMiddleware({
      findSession: deps.findSession,
      findMembership: deps.findMembership,
      privateKeyPem: privateKey,
    }),
  );
  app.get('/projects/:projectId/flags', (c) =>
    c.json({ jwt: c.get('jwt'), claims: c.get('claims') }),
  );
  return app;
};

const cookieHeader = (token: string): Record<string, string> => ({
  Cookie: `${SESSION_COOKIE}=${token}`,
});

describe('project auth middleware', () => {
  it('mints an owner JWT without a membership lookup', async () => {
    const findSession = vi
      .fn()
      .mockResolvedValue(
        makeSession({ user: makeUser({ id: 'owner-1', role: 'OWNER' }) }),
      );
    const findMembership = vi.fn();
    const app = buildApp({ findSession, findMembership });

    const res = await app.request('/projects/project-1/flags', {
      headers: cookieHeader('token-123.signature'),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claims).toMatchObject({
      userId: 'owner-1',
      systemRole: 'OWNER',
      projectId: 'project-1',
      projectRole: 'owner',
    });
    // Owner bypasses ProjectMember entirely.
    expect(findMembership).not.toHaveBeenCalled();
    // Signature was stripped from the cookie before lookup.
    expect(findSession).toHaveBeenCalledWith('token-123');

    const verified = verifyRs256({ token: body.jwt, publicKeyPem: publicKey });
    expect(verified.projectRole).toBe('owner');
  });

  it('mints an admin JWT for a member with the admin role', async () => {
    const findSession = vi
      .fn()
      .mockResolvedValue(
        makeSession({ user: makeUser({ id: 'member-1', role: 'MEMBER' }) }),
      );
    const findMembership = vi
      .fn()
      .mockResolvedValue(makeMembership({ userId: 'member-1', role: 'admin' }));
    const app = buildApp({ findSession, findMembership });

    const res = await app.request('/projects/project-1/flags', {
      headers: cookieHeader('token-123'),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claims).toMatchObject({
      userId: 'member-1',
      systemRole: 'MEMBER',
      projectId: 'project-1',
      projectRole: 'admin',
    });
    expect(findMembership).toHaveBeenCalledWith('member-1', 'project-1');
  });

  it('returns 403 for a member with no ProjectMember row', async () => {
    const findSession = vi
      .fn()
      .mockResolvedValue(makeSession({ user: makeUser({ role: 'MEMBER' }) }));
    const findMembership = vi.fn().mockResolvedValue(null);
    const app = buildApp({ findSession, findMembership });

    const res = await app.request('/projects/project-1/flags', {
      headers: cookieHeader('token-123'),
    });

    expect(res.status).toBe(403);
  });

  it('returns 401 when the session cookie is missing', async () => {
    const findSession = vi.fn();
    const findMembership = vi.fn();
    const app = buildApp({ findSession, findMembership });

    const res = await app.request('/projects/project-1/flags');

    expect(res.status).toBe(401);
    expect(findSession).not.toHaveBeenCalled();
  });

  it('returns 401 for an expired session', async () => {
    const findSession = vi
      .fn()
      .mockResolvedValue(
        makeSession({ expiresAt: new Date(Date.now() - 1_000) }),
      );
    const findMembership = vi.fn();
    const app = buildApp({ findSession, findMembership });

    const res = await app.request('/projects/project-1/flags', {
      headers: cookieHeader('token-123'),
    });

    expect(res.status).toBe(401);
  });

  it('returns 401 for an unknown session token', async () => {
    const findSession = vi.fn().mockResolvedValue(null);
    const findMembership = vi.fn();
    const app = buildApp({ findSession, findMembership });

    const res = await app.request('/projects/project-1/flags', {
      headers: cookieHeader('token-123'),
    });

    expect(res.status).toBe(401);
  });
});
