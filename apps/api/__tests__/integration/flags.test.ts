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
import { flagsRouter } from '../../src/routes/flags.js';
import { generateTestKeys } from '../helpers/keys.js';

vi.mock('@repo/prisma', () => ({
  prisma: {
    environment: { findMany: vi.fn() },
    flag: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    flagState: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    auditEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const { privateKey, publicKey } = generateTestKeys();

type AppEnv = { Variables: ApiAuthVariables };

const buildApp = (): Hono<AppEnv> => {
  const app = new Hono<AppEnv>();
  const jwtAuth = createJwtVerifyMiddleware({ publicKeyPem: publicKey });
  app.use('/projects/:projectId/*', jwtAuth);
  app.route('/projects/:projectId/flags', flagsRouter);
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
// GET /environments
// ---------------------------------------------------------------------------
describe('GET /projects/:projectId/flags/environments', () => {
  it('returns environments for a valid project member', async () => {
    mockPrisma.environment.findMany.mockResolvedValue([
      { id: 'env-1', name: 'production' },
      { id: 'env-2', name: 'staging' },
    ] as never);

    const res = await app.request(
      `/projects/${PROJECT_ID}/flags/environments`,
      { headers: bearer(ownerToken(PROJECT_ID)) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.environments).toHaveLength(2);
    expect(body.environments[0].name).toBe('production');
  });

  it('returns 401 with no auth header', async () => {
    const res = await app.request(`/projects/${PROJECT_ID}/flags/environments`);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST / — create flag
// ---------------------------------------------------------------------------
describe('POST /projects/:projectId/flags', () => {
  it('creates a flag with eager FlagState rows and returns 201', async () => {
    mockPrisma.environment.findMany.mockResolvedValue([
      { id: 'env-1' },
    ] as never);
    mockPrisma.flag.findUnique.mockResolvedValue(null);
    const createdFlag = {
      id: 'flag-1',
      key: 'my-flag',
      name: 'My Flag',
      projectId: PROJECT_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.flag.create.mockResolvedValue(createdFlag as never);

    const res = await app.request(`/projects/${PROJECT_ID}/flags`, {
      method: 'POST',
      headers: {
        ...bearer(ownerToken(PROJECT_ID)),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: 'my-flag', name: 'My Flag' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.flag.key).toBe('my-flag');
    expect(mockPrisma.flag.create).toHaveBeenCalledOnce();
  });

  it('returns 409 when a flag with the same key already exists', async () => {
    mockPrisma.flag.findUnique.mockResolvedValue({ id: 'existing' } as never);

    const res = await app.request(`/projects/${PROJECT_ID}/flags`, {
      method: 'POST',
      headers: {
        ...bearer(ownerToken(PROJECT_ID)),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: 'my-flag', name: 'My Flag' }),
    });

    expect(res.status).toBe(409);
  });

  it('returns 400 when key contains invalid characters', async () => {
    const res = await app.request(`/projects/${PROJECT_ID}/flags`, {
      method: 'POST',
      headers: {
        ...bearer(ownerToken(PROJECT_ID)),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: 'My Flag!', name: 'My Flag' }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 when key is missing', async () => {
    const res = await app.request(`/projects/${PROJECT_ID}/flags`, {
      method: 'POST',
      headers: {
        ...bearer(ownerToken(PROJECT_ID)),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'My Flag' }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 403 when a viewer tries to create a flag', async () => {
    const res = await app.request(`/projects/${PROJECT_ID}/flags`, {
      method: 'POST',
      headers: {
        ...bearer(viewerToken(PROJECT_ID)),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: 'my-flag', name: 'My Flag' }),
    });

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET / — list flags
// ---------------------------------------------------------------------------
describe('GET /projects/:projectId/flags', () => {
  it('returns flags for a given environmentId, excluding archived', async () => {
    mockPrisma.flag.findMany.mockResolvedValue([
      {
        id: 'flag-1',
        key: 'active-flag',
        name: 'Active Flag',
        projectId: PROJECT_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        states: [{ status: 'active' }],
      },
      {
        id: 'flag-2',
        key: 'archived-flag',
        name: 'Archived Flag',
        projectId: PROJECT_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        states: [{ status: 'archived' }],
      },
    ] as never);

    const res = await app.request(
      `/projects/${PROJECT_ID}/flags?environmentId=env-1`,
      { headers: bearer(viewerToken(PROJECT_ID)) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flags).toHaveLength(1);
    expect(body.flags[0].key).toBe('active-flag');
  });

  it('returns 400 when environmentId is missing', async () => {
    const res = await app.request(`/projects/${PROJECT_ID}/flags`, {
      headers: bearer(viewerToken(PROJECT_ID)),
    });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /:flagId — flag detail
// ---------------------------------------------------------------------------
describe('GET /projects/:projectId/flags/:flagId', () => {
  it('returns the flag with states and audit log', async () => {
    mockPrisma.flag.findUnique.mockResolvedValue({
      id: 'flag-1',
      key: 'my-flag',
      name: 'My Flag',
      projectId: PROJECT_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
      states: [
        {
          id: 'state-1',
          environment: { id: 'env-1', name: 'production' },
          status: 'active',
        },
      ],
      auditLog: [
        {
          id: 'audit-1',
          action: 'flag.created',
          meta: {},
          createdAt: new Date(),
          user: { id: 'user-owner', name: 'Owner' },
        },
      ],
    } as never);

    const res = await app.request(`/projects/${PROJECT_ID}/flags/flag-1`, {
      headers: bearer(viewerToken(PROJECT_ID)),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flag.key).toBe('my-flag');
    expect(body.flag.states).toHaveLength(1);
    expect(body.flag.auditLog).toHaveLength(1);
    expect(body.flag.auditLog[0].action).toBe('flag.created');
  });

  it('returns 404 when the flag does not exist', async () => {
    mockPrisma.flag.findUnique.mockResolvedValue(null);

    const res = await app.request(`/projects/${PROJECT_ID}/flags/missing`, {
      headers: bearer(viewerToken(PROJECT_ID)),
    });

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PATCH /:flagId — rename
// ---------------------------------------------------------------------------
describe('PATCH /projects/:projectId/flags/:flagId (rename)', () => {
  it('renames the flag and records an audit event', async () => {
    const existing = {
      id: 'flag-1',
      key: 'my-flag',
      name: 'Old Name',
      projectId: PROJECT_ID,
    };
    mockPrisma.flag.findUnique.mockResolvedValue(existing as never);

    const updated = { ...existing, name: 'New Name' };
    mockPrisma.$transaction.mockResolvedValue([updated] as never);

    const res = await app.request(`/projects/${PROJECT_ID}/flags/flag-1`, {
      method: 'PATCH',
      headers: {
        ...bearer(ownerToken(PROJECT_ID)),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'New Name' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flag.name).toBe('New Name');
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
  });

  it('returns 400 when name is missing', async () => {
    const res = await app.request(`/projects/${PROJECT_ID}/flags/flag-1`, {
      method: 'PATCH',
      headers: {
        ...bearer(ownerToken(PROJECT_ID)),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it('returns 403 for a viewer', async () => {
    const res = await app.request(`/projects/${PROJECT_ID}/flags/flag-1`, {
      method: 'PATCH',
      headers: {
        ...bearer(viewerToken(PROJECT_ID)),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'New Name' }),
    });

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// PATCH /:flagId/environments/:environmentId — toggle
// ---------------------------------------------------------------------------
describe('PATCH /projects/:projectId/flags/:flagId/environments/:environmentId', () => {
  it('toggles the flag to active and records an audit event', async () => {
    mockPrisma.flagState.findUnique.mockResolvedValue({
      id: 'state-1',
      flagId: 'flag-1',
      environmentId: 'env-1',
      status: 'inactive',
      flag: { projectId: PROJECT_ID },
    } as never);

    const updatedState = {
      id: 'state-1',
      flagId: 'flag-1',
      environmentId: 'env-1',
      status: 'active',
    };
    mockPrisma.$transaction.mockResolvedValue([updatedState] as never);

    const res = await app.request(
      `/projects/${PROJECT_ID}/flags/flag-1/environments/env-1`,
      {
        method: 'PATCH',
        headers: {
          ...bearer(ownerToken(PROJECT_ID)),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'active' }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flagState.status).toBe('active');
  });

  it('returns 409 when trying to toggle an archived flag', async () => {
    mockPrisma.flagState.findUnique.mockResolvedValue({
      id: 'state-1',
      flagId: 'flag-1',
      environmentId: 'env-1',
      status: 'archived',
      flag: { projectId: PROJECT_ID },
    } as never);

    const res = await app.request(
      `/projects/${PROJECT_ID}/flags/flag-1/environments/env-1`,
      {
        method: 'PATCH',
        headers: {
          ...bearer(ownerToken(PROJECT_ID)),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'active' }),
      },
    );

    expect(res.status).toBe(409);
  });

  it('returns 400 for an invalid status value', async () => {
    const res = await app.request(
      `/projects/${PROJECT_ID}/flags/flag-1/environments/env-1`,
      {
        method: 'PATCH',
        headers: {
          ...bearer(ownerToken(PROJECT_ID)),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'archived' }),
      },
    );

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /:flagId/archive
// ---------------------------------------------------------------------------
describe('POST /projects/:projectId/flags/:flagId/archive', () => {
  it('archives the flag and returns updated states', async () => {
    mockPrisma.flag.findUnique.mockResolvedValue({
      id: 'flag-1',
      projectId: PROJECT_ID,
    } as never);

    mockPrisma.$transaction.mockResolvedValue([] as never);

    const archivedFlag = {
      id: 'flag-1',
      key: 'my-flag',
      name: 'My Flag',
      projectId: PROJECT_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
      states: [
        {
          id: 'state-1',
          environment: { id: 'env-1', name: 'production' },
          status: 'archived',
        },
      ],
    };
    mockPrisma.flag.findUniqueOrThrow.mockResolvedValue(archivedFlag as never);

    const res = await app.request(
      `/projects/${PROJECT_ID}/flags/flag-1/archive`,
      {
        method: 'POST',
        headers: bearer(ownerToken(PROJECT_ID)),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flag.states[0].status).toBe('archived');
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
  });

  it('returns 404 when the flag does not exist', async () => {
    mockPrisma.flag.findUnique.mockResolvedValue(null);

    const res = await app.request(
      `/projects/${PROJECT_ID}/flags/missing/archive`,
      {
        method: 'POST',
        headers: bearer(ownerToken(PROJECT_ID)),
      },
    );

    expect(res.status).toBe(404);
  });

  it('returns 403 for a viewer', async () => {
    const res = await app.request(
      `/projects/${PROJECT_ID}/flags/flag-1/archive`,
      {
        method: 'POST',
        headers: bearer(viewerToken(PROJECT_ID)),
      },
    );

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// POST /:flagId/unarchive
// ---------------------------------------------------------------------------
describe('POST /projects/:projectId/flags/:flagId/unarchive', () => {
  it('unarchives the flag and returns updated states', async () => {
    mockPrisma.flag.findUnique.mockResolvedValue({
      id: 'flag-1',
      projectId: PROJECT_ID,
    } as never);

    mockPrisma.$transaction.mockResolvedValue([] as never);

    const unarchivedFlag = {
      id: 'flag-1',
      key: 'my-flag',
      name: 'My Flag',
      projectId: PROJECT_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
      states: [
        {
          id: 'state-1',
          environment: { id: 'env-1', name: 'production' },
          status: 'inactive',
        },
      ],
    };
    mockPrisma.flag.findUniqueOrThrow.mockResolvedValue(
      unarchivedFlag as never,
    );

    const res = await app.request(
      `/projects/${PROJECT_ID}/flags/flag-1/unarchive`,
      {
        method: 'POST',
        headers: bearer(ownerToken(PROJECT_ID)),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flag.states[0].status).toBe('inactive');
  });
});

// ---------------------------------------------------------------------------
// DELETE /:flagId
// ---------------------------------------------------------------------------
describe('DELETE /projects/:projectId/flags/:flagId', () => {
  it('deletes the flag and returns 204', async () => {
    mockPrisma.flag.findUnique.mockResolvedValue({
      id: 'flag-1',
      projectId: PROJECT_ID,
    } as never);
    mockPrisma.flag.delete.mockResolvedValue({} as never);

    const res = await app.request(`/projects/${PROJECT_ID}/flags/flag-1`, {
      method: 'DELETE',
      headers: bearer(ownerToken(PROJECT_ID)),
    });

    expect(res.status).toBe(204);
    expect(mockPrisma.flag.delete).toHaveBeenCalledWith({
      where: { id: 'flag-1' },
    });
  });

  it('returns 404 when the flag does not exist', async () => {
    mockPrisma.flag.findUnique.mockResolvedValue(null);

    const res = await app.request(`/projects/${PROJECT_ID}/flags/missing`, {
      method: 'DELETE',
      headers: bearer(ownerToken(PROJECT_ID)),
    });

    expect(res.status).toBe(404);
  });

  it('returns 403 for a viewer', async () => {
    const res = await app.request(`/projects/${PROJECT_ID}/flags/flag-1`, {
      method: 'DELETE',
      headers: bearer(viewerToken(PROJECT_ID)),
    });

    expect(res.status).toBe(403);
  });
});
