import type { ProjectJwtClaims } from '@repo/auth';
import { signRs256 } from '@repo/auth/jwt';
import { PROJECT_ROLE, SYSTEM_ROLE } from '@repo/auth/roles';
import { prisma } from '@repo/prisma';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type ApiAuthVariables,
  createJwtVerifyMiddleware,
} from '../../src/auth/middleware.js';
import { apiKeysRouter } from '../../src/routes/apiKeys.js';
import { generateTestKeys } from '../helpers/keys.js';

vi.mock('@repo/prisma', () => ({
  prisma: {
    apiKey: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    environment: { findUnique: vi.fn() },
  },
}));

vi.mock('@repo/auth/api-key', () => ({
  generateApiKey: vi.fn().mockResolvedValue({
    fullKey: 'env_abc123.secretvalue',
    apiKeyId: 'abc123',
    apiKeyHash: '$2a$10$hashedvalue',
  }),
}));

const { privateKey, publicKey } = generateTestKeys();

type AppEnv = { Variables: ApiAuthVariables };

const buildApp = (): Hono<AppEnv> => {
  const app = new Hono<AppEnv>();
  const jwtAuth = createJwtVerifyMiddleware({ publicKeyPem: publicKey });
  app.use('/projects/:projectId/*', jwtAuth);
  app.route('/projects/:projectId/api-keys', apiKeysRouter);
  return app;
};

const ownerToken = (projectId: string): string =>
  signRs256({
    payload: {
      userId: 'user-owner',
      systemRole: SYSTEM_ROLE.OWNER,
      projectId,
      projectRole: PROJECT_ROLE.OWNER,
    } satisfies ProjectJwtClaims,
    privateKeyPem: privateKey,
    expiresInSeconds: 60,
  });

const viewerToken = (projectId: string): string =>
  signRs256({
    payload: {
      userId: 'user-viewer',
      systemRole: SYSTEM_ROLE.MEMBER,
      projectId,
      projectRole: PROJECT_ROLE.VIEWER,
    } satisfies ProjectJwtClaims,
    privateKeyPem: privateKey,
    expiresInSeconds: 60,
  });

const bearer = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
});

const PROJECT_ID = 'project-1';
const app = buildApp();

const mockPrisma = vi.mocked(prisma);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET / — list api keys
// ---------------------------------------------------------------------------
describe('GET /projects/:projectId/api-keys', () => {
  it('returns api keys for a valid project member', async () => {
    mockPrisma.apiKey.findMany.mockResolvedValue([
      {
        id: 'key-1',
        name: 'Default',
        apiKeyId: 'abc123',
        revokedAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        environment: { id: 'env-1', name: 'production' },
      },
    ] as never);

    const res = await app.request(`/projects/${PROJECT_ID}/api-keys`, {
      headers: bearer(ownerToken(PROJECT_ID)),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.apiKeys).toHaveLength(1);
    expect(body.apiKeys[0]).toMatchObject({
      id: 'key-1',
      name: 'Default',
      apiKeyId: 'abc123',
      environmentId: 'env-1',
      environmentName: 'production',
      revokedAt: null,
    });
  });

  it('returns 401 with no auth header', async () => {
    const res = await app.request(`/projects/${PROJECT_ID}/api-keys`);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST / — create api key
// ---------------------------------------------------------------------------
describe('POST /projects/:projectId/api-keys', () => {
  it('creates an api key and returns the full key once', async () => {
    mockPrisma.environment.findUnique.mockResolvedValue({
      id: 'env-1',
      name: 'production',
    } as never);
    mockPrisma.apiKey.create.mockResolvedValue({
      id: 'key-1',
      name: 'Server key',
      apiKeyId: 'abc123',
      revokedAt: null,
      createdAt: new Date(),
    } as never);

    const res = await app.request(`/projects/${PROJECT_ID}/api-keys`, {
      method: 'POST',
      headers: {
        ...bearer(ownerToken(PROJECT_ID)),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Server key', environmentId: 'env-1' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.fullKey).toBe('env_abc123.secretvalue');
    expect(body.apiKey.environmentName).toBe('production');
  });

  it('returns 403 for a viewer', async () => {
    const res = await app.request(`/projects/${PROJECT_ID}/api-keys`, {
      method: 'POST',
      headers: {
        ...bearer(viewerToken(PROJECT_ID)),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Server key', environmentId: 'env-1' }),
    });

    expect(res.status).toBe(403);
  });

  it('returns 400 when name is missing', async () => {
    const res = await app.request(`/projects/${PROJECT_ID}/api-keys`, {
      method: 'POST',
      headers: {
        ...bearer(ownerToken(PROJECT_ID)),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ environmentId: 'env-1' }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 404 when the environment does not belong to the project', async () => {
    mockPrisma.environment.findUnique.mockResolvedValue(null);

    const res = await app.request(`/projects/${PROJECT_ID}/api-keys`, {
      method: 'POST',
      headers: {
        ...bearer(ownerToken(PROJECT_ID)),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Server key', environmentId: 'env-1' }),
    });

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /:apiKeyId/rotate
// ---------------------------------------------------------------------------
describe('POST /projects/:projectId/api-keys/:apiKeyId/rotate', () => {
  it('rotates an active key and returns a new full key', async () => {
    mockPrisma.apiKey.findFirst.mockResolvedValue({
      id: 'key-1',
      revokedAt: null,
    } as never);
    mockPrisma.apiKey.update.mockResolvedValue({} as never);

    const res = await app.request(
      `/projects/${PROJECT_ID}/api-keys/key-1/rotate`,
      { method: 'POST', headers: bearer(ownerToken(PROJECT_ID)) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fullKey).toBe('env_abc123.secretvalue');
  });

  it('returns 404 when the key does not exist', async () => {
    mockPrisma.apiKey.findFirst.mockResolvedValue(null);

    const res = await app.request(
      `/projects/${PROJECT_ID}/api-keys/missing/rotate`,
      { method: 'POST', headers: bearer(ownerToken(PROJECT_ID)) },
    );

    expect(res.status).toBe(404);
  });

  it('returns 409 when the key is already revoked', async () => {
    mockPrisma.apiKey.findFirst.mockResolvedValue({
      id: 'key-1',
      revokedAt: new Date(),
    } as never);

    const res = await app.request(
      `/projects/${PROJECT_ID}/api-keys/key-1/rotate`,
      { method: 'POST', headers: bearer(ownerToken(PROJECT_ID)) },
    );

    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// POST /:apiKeyId/revoke
// ---------------------------------------------------------------------------
describe('POST /projects/:projectId/api-keys/:apiKeyId/revoke', () => {
  it('revokes an active key', async () => {
    mockPrisma.apiKey.findFirst.mockResolvedValue({
      id: 'key-1',
      revokedAt: null,
    } as never);
    const revokedAt = new Date();
    mockPrisma.apiKey.update.mockResolvedValue({
      id: 'key-1',
      revokedAt,
    } as never);

    const res = await app.request(
      `/projects/${PROJECT_ID}/api-keys/key-1/revoke`,
      { method: 'POST', headers: bearer(ownerToken(PROJECT_ID)) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.apiKey.id).toBe('key-1');
    expect(body.apiKey.revokedAt).not.toBeNull();
  });

  it('returns 409 when already revoked', async () => {
    mockPrisma.apiKey.findFirst.mockResolvedValue({
      id: 'key-1',
      revokedAt: new Date(),
    } as never);

    const res = await app.request(
      `/projects/${PROJECT_ID}/api-keys/key-1/revoke`,
      { method: 'POST', headers: bearer(ownerToken(PROJECT_ID)) },
    );

    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// DELETE /:apiKeyId
// ---------------------------------------------------------------------------
describe('DELETE /projects/:projectId/api-keys/:apiKeyId', () => {
  it('deletes an existing key', async () => {
    mockPrisma.apiKey.deleteMany.mockResolvedValue({ count: 1 } as never);

    const res = await app.request(`/projects/${PROJECT_ID}/api-keys/key-1`, {
      method: 'DELETE',
      headers: bearer(ownerToken(PROJECT_ID)),
    });

    expect(res.status).toBe(204);
  });

  it('returns 404 when nothing was deleted', async () => {
    mockPrisma.apiKey.deleteMany.mockResolvedValue({ count: 0 } as never);

    const res = await app.request(`/projects/${PROJECT_ID}/api-keys/missing`, {
      method: 'DELETE',
      headers: bearer(ownerToken(PROJECT_ID)),
    });

    expect(res.status).toBe(404);
  });

  it('returns 403 for a viewer', async () => {
    const res = await app.request(`/projects/${PROJECT_ID}/api-keys/key-1`, {
      method: 'DELETE',
      headers: bearer(viewerToken(PROJECT_ID)),
    });

    expect(res.status).toBe(403);
  });
});
