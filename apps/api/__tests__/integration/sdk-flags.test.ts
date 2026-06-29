import type { SdkJwtClaims, ProjectJwtClaims } from '@repo/auth';
import { signRs256 } from '@repo/auth/jwt';
import { PROJECT_ROLE, SYSTEM_ROLE } from '@repo/auth/roles';
import { prisma } from '@repo/prisma';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type ApiAuthVariables,
  createJwtVerifyMiddleware,
} from '../../src/auth/middleware.js';
import { sdkRouter } from '../../src/routes/sdk.js';
import { generateTestKeys } from '../helpers/keys.js';

vi.mock('@repo/prisma', () => ({
  prisma: {
    flag: { findMany: vi.fn() },
  },
}));

const { privateKey, publicKey } = generateTestKeys();

type AppEnv = { Variables: ApiAuthVariables };

const buildApp = (): Hono<AppEnv> => {
  const app = new Hono<AppEnv>();
  const jwtAuth = createJwtVerifyMiddleware({ publicKeyPem: publicKey });
  app.use('/v1/*', jwtAuth);
  app.route('/v1', sdkRouter);
  return app;
};

const sdkToken = (projectId: string, environmentId: string): string =>
  signRs256({
    payload: {
      projectId,
      environmentId,
      projectRole: PROJECT_ROLE.SDK_CLIENT,
    } satisfies SdkJwtClaims,
    privateKeyPem: privateKey,
    expiresInSeconds: 60,
  });

const projectToken = (projectId: string): string =>
  signRs256({
    payload: {
      userId: 'user-1',
      systemRole: SYSTEM_ROLE.OWNER,
      projectId,
      projectRole: PROJECT_ROLE.OWNER,
    } satisfies ProjectJwtClaims,
    privateKeyPem: privateKey,
    expiresInSeconds: 60,
  });

describe('GET /v1/flags', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps active status to enabled:true and inactive to enabled:false', async () => {
    vi.mocked(prisma.flag.findMany).mockResolvedValue([
      {
        id: 'flag-1',
        key: 'active-flag',
        name: 'Active',
        projectId: 'proj-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        states: [{ status: 'active' }],
      },
      {
        id: 'flag-2',
        key: 'inactive-flag',
        name: 'Inactive',
        projectId: 'proj-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        states: [{ status: 'inactive' }],
      },
    ] as never);

    const app = buildApp();
    const res = await app.request('/v1/flags', {
      headers: { Authorization: `Bearer ${sdkToken('proj-1', 'env-1')}` },
    });

    const body = await res.json();
    expect(body.flags).toEqual([
      { key: 'active-flag', enabled: true },
      { key: 'inactive-flag', enabled: false },
    ]);
  });

  it('excludes archived flags from the snapshot', async () => {
    vi.mocked(prisma.flag.findMany).mockResolvedValue([
      {
        id: 'flag-1',
        key: 'live-flag',
        name: 'Live',
        projectId: 'proj-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        states: [{ status: 'active' }],
      },
      {
        id: 'flag-2',
        key: 'archived-flag',
        name: 'Archived',
        projectId: 'proj-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        states: [{ status: 'archived' }],
      },
    ] as never);

    const app = buildApp();
    const res = await app.request('/v1/flags', {
      headers: { Authorization: `Bearer ${sdkToken('proj-1', 'env-1')}` },
    });

    const body = await res.json();
    expect(body.flags).toEqual([{ key: 'live-flag', enabled: true }]);
  });

  it('returns empty flags array when no flags exist', async () => {
    vi.mocked(prisma.flag.findMany).mockResolvedValue([] as never);

    const app = buildApp();
    const res = await app.request('/v1/flags', {
      headers: { Authorization: `Bearer ${sdkToken('proj-1', 'env-1')}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ flags: [] });
  });

  it('returns 403 for a project-scoped JWT', async () => {
    const app = buildApp();
    const res = await app.request('/v1/flags', {
      headers: { Authorization: `Bearer ${projectToken('proj-1')}` },
    });

    expect(res.status).toBe(403);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const app = buildApp();
    const res = await app.request('/v1/flags');

    expect(res.status).toBe(401);
  });

  it('returns a flag snapshot for a valid SDK JWT', async () => {
    vi.mocked(prisma.flag.findMany).mockResolvedValue([
      {
        id: 'flag-1',
        key: 'dark-mode',
        name: 'Dark Mode',
        projectId: 'proj-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        states: [{ status: 'active' }],
      },
      {
        id: 'flag-2',
        key: 'new-onboarding',
        name: 'New Onboarding',
        projectId: 'proj-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        states: [{ status: 'inactive' }],
      },
    ] as never);

    const app = buildApp();
    const res = await app.request('/v1/flags', {
      headers: { Authorization: `Bearer ${sdkToken('proj-1', 'env-1')}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      flags: [
        { key: 'dark-mode', enabled: true },
        { key: 'new-onboarding', enabled: false },
      ],
    });
  });
});
