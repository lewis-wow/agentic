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
import { emitFlagEvent } from '../../src/events/emitter.js';
import { flagsRouter } from '../../src/routes/flags.js';
import { generateTestKeys } from '../helpers/keys.js';

vi.mock('@repo/prisma', () => ({
  prisma: {
    environment: { findMany: vi.fn() },
    flag: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    flagState: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    auditEvent: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../src/events/emitter.js', () => ({
  emitFlagEvent: vi.fn(),
  flagEmitter: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
  getRingBuffer: vi.fn().mockReturnValue([]),
  _resetForTesting: vi.fn(),
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
  it('filters to a single status when status is given, excluding archived', async () => {
    mockPrisma.flag.findMany.mockResolvedValue([
      {
        id: 'flag-1',
        key: 'active-flag',
        name: 'Active Flag',
        projectId: PROJECT_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        states: [{ status: 'active', type: 'boolean', rollout: 0 }],
      },
    ] as never);
    mockPrisma.flag.count.mockResolvedValue(1 as never);

    const res = await app.request(
      `/projects/${PROJECT_ID}/flags?environmentId=env-1&status=active`,
      { headers: bearer(viewerToken(PROJECT_ID)) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].key).toBe('active-flag');
  });

  it('includes archived flags by default (status=all)', async () => {
    mockPrisma.flag.findMany.mockResolvedValue([
      {
        id: 'flag-1',
        key: 'active-flag',
        name: 'Active Flag',
        projectId: PROJECT_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        states: [{ status: 'active', type: 'boolean', rollout: 0 }],
      },
      {
        id: 'flag-2',
        key: 'archived-flag',
        name: 'Archived Flag',
        projectId: PROJECT_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        states: [{ status: 'archived', type: 'boolean', rollout: 0 }],
      },
    ] as never);
    mockPrisma.flag.count.mockResolvedValue(2 as never);

    const res = await app.request(
      `/projects/${PROJECT_ID}/flags?environmentId=env-1`,
      { headers: bearer(viewerToken(PROJECT_ID)) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items.map((f: { key: string }) => f.key)).toEqual([
      'active-flag',
      'archived-flag',
    ]);
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
  it('returns the flag with states (no auditLog embedded)', async () => {
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
          type: 'boolean',
          rollout: 0,
          rules: [],
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
    expect(body.flag).not.toHaveProperty('auditLog');
  });

  it('includes type and rollout in each state', async () => {
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
          type: 'percentage_rollout',
          rollout: 42,
          rules: [],
          environment: { id: 'env-1', name: 'production' },
          status: 'active',
        },
      ],
    } as never);

    const res = await app.request(`/projects/${PROJECT_ID}/flags/flag-1`, {
      headers: bearer(viewerToken(PROJECT_ID)),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flag.states[0].type).toBe('percentage_rollout');
    expect(body.flag.states[0].rollout).toBe(42);
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
      createdAt: new Date(),
      updatedAt: new Date(),
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
      environment: { id: 'env-1', name: 'production' },
    } as never);

    const updatedState = {
      id: 'state-1',
      flagId: 'flag-1',
      environmentId: 'env-1',
      status: 'active',
      type: 'boolean',
      rollout: 0,
      rules: [],
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

  it('updates type and rollout and returns the updated FlagState', async () => {
    mockPrisma.flagState.findUnique.mockResolvedValue({
      id: 'state-1',
      flagId: 'flag-1',
      environmentId: 'env-1',
      status: 'active',
      type: 'boolean',
      rollout: 0,
      flag: { projectId: PROJECT_ID, key: 'my-flag' },
      environment: { id: 'env-1', name: 'production' },
    } as never);
    mockPrisma.$transaction.mockResolvedValue([
      {
        id: 'state-1',
        flagId: 'flag-1',
        environmentId: 'env-1',
        status: 'active',
        type: 'percentage_rollout',
        rollout: 42,
        rules: [],
      },
    ] as never);

    const res = await app.request(
      `/projects/${PROJECT_ID}/flags/flag-1/environments/env-1`,
      {
        method: 'PATCH',
        headers: {
          ...bearer(ownerToken(PROJECT_ID)),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'percentage_rollout', rollout: 42 }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flagState.type).toBe('percentage_rollout');
    expect(body.flagState.rollout).toBe(42);
  });

  it('returns 400 RequestValidationFailed for a truly unknown type value', async () => {
    const res = await app.request(
      `/projects/${PROJECT_ID}/flags/flag-1/environments/env-1`,
      {
        method: 'PATCH',
        headers: {
          ...bearer(ownerToken(PROJECT_ID)),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'unknown-type' }),
      },
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('RequestValidationFailed');
  });

  it('accepts targeted type with valid rules and writes them', async () => {
    mockPrisma.flagState.findUnique.mockResolvedValue({
      id: 'state-1',
      flagId: 'flag-1',
      environmentId: 'env-1',
      status: 'active',
      type: 'boolean',
      rollout: 0,
      rules: [],
      flag: { projectId: PROJECT_ID, key: 'my-flag' },
      environment: { id: 'env-1', name: 'production' },
    } as never);
    const updatedState = {
      id: 'state-1',
      flagId: 'flag-1',
      environmentId: 'env-1',
      status: 'active',
      type: 'targeted',
      rollout: 0,
      rules: [{ attribute: 'plan', operator: 'EQ', value: ['pro'] }],
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
        body: JSON.stringify({
          type: 'targeted',
          rules: [{ attribute: 'plan', operator: 'EQ', value: ['pro'] }],
        }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flagState.type).toBe('targeted');
    expect(body.flagState.rules).toEqual([
      { attribute: 'plan', operator: 'EQ', value: ['pro'] },
    ]);
  });

  it('returns 400 RequestValidationFailed when rules have a missing attribute', async () => {
    const res = await app.request(
      `/projects/${PROJECT_ID}/flags/flag-1/environments/env-1`,
      {
        method: 'PATCH',
        headers: {
          ...bearer(ownerToken(PROJECT_ID)),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'targeted',
          rules: [{ operator: 'EQ', value: ['pro'] }],
        }),
      },
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('RequestValidationFailed');
  });

  it('returns 400 RequestValidationFailed when rules has an invalid operator', async () => {
    const res = await app.request(
      `/projects/${PROJECT_ID}/flags/flag-1/environments/env-1`,
      {
        method: 'PATCH',
        headers: {
          ...bearer(ownerToken(PROJECT_ID)),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'targeted',
          rules: [
            { attribute: 'plan', operator: 'STARTS_WITH', value: ['pro'] },
          ],
        }),
      },
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('RequestValidationFailed');
  });

  it('PATCH with targeted but no rules field leaves existing rules unchanged', async () => {
    mockPrisma.flagState.findUnique.mockResolvedValue({
      id: 'state-1',
      flagId: 'flag-1',
      environmentId: 'env-1',
      status: 'active',
      type: 'boolean',
      rollout: 0,
      rules: [{ attribute: 'plan', operator: 'EQ', value: ['pro'] }],
      flag: { projectId: PROJECT_ID, key: 'my-flag' },
      environment: { id: 'env-1', name: 'production' },
    } as never);
    const updatedState = {
      id: 'state-1',
      flagId: 'flag-1',
      environmentId: 'env-1',
      status: 'active',
      type: 'targeted',
      rollout: 0,
      rules: [{ attribute: 'plan', operator: 'EQ', value: ['pro'] }],
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
        body: JSON.stringify({ type: 'targeted' }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flagState.rules).toEqual([
      { attribute: 'plan', operator: 'EQ', value: ['pro'] },
    ]);
    // rules should NOT be in the updateData passed to prisma
    const transactionCall = mockPrisma.$transaction.mock.calls[0];
    expect(transactionCall).toBeDefined();
  });

  it('emits flag_updated with rules from the updated state', async () => {
    mockPrisma.flagState.findUnique.mockResolvedValue({
      id: 'state-1',
      flagId: 'flag-1',
      environmentId: 'env-1',
      status: 'active',
      type: 'boolean',
      rollout: 0,
      rules: [],
      flag: { projectId: PROJECT_ID, key: 'my-flag' },
      environment: { id: 'env-1', name: 'production' },
    } as never);
    mockPrisma.$transaction.mockResolvedValue([
      {
        id: 'state-1',
        flagId: 'flag-1',
        environmentId: 'env-1',
        status: 'active',
        type: 'targeted',
        rollout: 0,
        rules: [{ attribute: 'plan', operator: 'EQ', value: ['pro'] }],
      },
    ] as never);

    const mockEmit = vi.mocked(emitFlagEvent);

    await app.request(
      `/projects/${PROJECT_ID}/flags/flag-1/environments/env-1`,
      {
        method: 'PATCH',
        headers: {
          ...bearer(ownerToken(PROJECT_ID)),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'targeted',
          rules: [{ attribute: 'plan', operator: 'EQ', value: ['pro'] }],
        }),
      },
    );

    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'flag_updated',
        payload: expect.objectContaining({
          rules: [{ attribute: 'plan', operator: 'EQ', value: ['pro'] }],
        }),
      }),
    );
  });

  it('returns 400 RequestValidationFailed when rollout is outside 0–100', async () => {
    const res = await app.request(
      `/projects/${PROJECT_ID}/flags/flag-1/environments/env-1`,
      {
        method: 'PATCH',
        headers: {
          ...bearer(ownerToken(PROJECT_ID)),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rollout: 101 }),
      },
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('RequestValidationFailed');
  });

  it('returns 400 RequestValidationFailed when rollout is not an integer', async () => {
    const res = await app.request(
      `/projects/${PROJECT_ID}/flags/flag-1/environments/env-1`,
      {
        method: 'PATCH',
        headers: {
          ...bearer(ownerToken(PROJECT_ID)),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rollout: 42.5 }),
      },
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('RequestValidationFailed');
  });

  it('returns 400 when body is empty (no fields provided)', async () => {
    const res = await app.request(
      `/projects/${PROJECT_ID}/flags/flag-1/environments/env-1`,
      {
        method: 'PATCH',
        headers: {
          ...bearer(ownerToken(PROJECT_ID)),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      },
    );

    expect(res.status).toBe(400);
  });

  it('emits flag_updated with type and rollout from the updated state', async () => {
    mockPrisma.flagState.findUnique.mockResolvedValue({
      id: 'state-1',
      flagId: 'flag-1',
      environmentId: 'env-1',
      status: 'active',
      type: 'boolean',
      rollout: 0,
      flag: { projectId: PROJECT_ID, key: 'my-flag' },
      environment: { id: 'env-1', name: 'production' },
    } as never);
    mockPrisma.$transaction.mockResolvedValue([
      {
        id: 'state-1',
        flagId: 'flag-1',
        environmentId: 'env-1',
        status: 'active',
        type: 'percentage_rollout',
        rollout: 25,
        rules: [],
      },
    ] as never);

    const mockEmit = vi.mocked(emitFlagEvent);

    await app.request(
      `/projects/${PROJECT_ID}/flags/flag-1/environments/env-1`,
      {
        method: 'PATCH',
        headers: {
          ...bearer(ownerToken(PROJECT_ID)),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'percentage_rollout', rollout: 25 }),
      },
    );

    expect(mockEmit).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      environmentId: 'env-1',
      type: 'flag_updated',
      payload: {
        key: 'my-flag',
        enabled: true,
        type: 'percentage_rollout',
        rollout: 25,
      },
    });
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
          type: 'boolean',
          rollout: 0,
          rules: [],
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
          type: 'boolean',
          rollout: 0,
          rules: [],
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

// ---------------------------------------------------------------------------
// Flag event emission
// ---------------------------------------------------------------------------
describe('flag event emission', () => {
  const mockEmit = vi.mocked(emitFlagEvent);

  it('POST / emits flag_created with enabled:false', async () => {
    mockPrisma.environment.findMany.mockResolvedValue([] as never);
    mockPrisma.flag.findUnique.mockResolvedValue(null);
    mockPrisma.flag.create.mockResolvedValue({
      id: 'flag-1',
      key: 'my-flag',
      name: 'My Flag',
      projectId: PROJECT_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    await app.request(`/projects/${PROJECT_ID}/flags`, {
      method: 'POST',
      headers: {
        ...bearer(ownerToken(PROJECT_ID)),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: 'my-flag', name: 'My Flag' }),
    });

    expect(mockEmit).toHaveBeenCalledOnce();
    expect(mockEmit).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      environmentId: null,
      type: 'flag_created',
      payload: { key: 'my-flag', enabled: false, type: 'boolean', rollout: 0 },
    });
  });

  it('PATCH /:flagId/environments/:environmentId emits flag_updated scoped to that env', async () => {
    mockPrisma.flagState.findUnique.mockResolvedValue({
      id: 'state-1',
      flagId: 'flag-1',
      environmentId: 'env-1',
      status: 'inactive',
      type: 'boolean',
      rollout: 0,
      flag: { projectId: PROJECT_ID, key: 'my-flag' },
      environment: { id: 'env-1', name: 'production' },
    } as never);
    mockPrisma.$transaction.mockResolvedValue([
      {
        id: 'state-1',
        flagId: 'flag-1',
        environmentId: 'env-1',
        status: 'active',
        type: 'boolean',
        rollout: 0,
        rules: [],
      },
    ] as never);

    await app.request(
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

    expect(mockEmit).toHaveBeenCalledOnce();
    expect(mockEmit).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      environmentId: 'env-1',
      type: 'flag_updated',
      payload: { key: 'my-flag', enabled: true, type: 'boolean', rollout: 0 },
    });
  });

  it('POST /:flagId/archive emits flag_archived with no environmentId', async () => {
    mockPrisma.flag.findUnique.mockResolvedValue({
      id: 'flag-1',
      key: 'my-flag',
      projectId: PROJECT_ID,
    } as never);
    mockPrisma.$transaction.mockResolvedValue([] as never);
    mockPrisma.flag.findUniqueOrThrow.mockResolvedValue({
      id: 'flag-1',
      key: 'my-flag',
      name: 'My Flag',
      projectId: PROJECT_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
      states: [],
    } as never);

    await app.request(`/projects/${PROJECT_ID}/flags/flag-1/archive`, {
      method: 'POST',
      headers: bearer(ownerToken(PROJECT_ID)),
    });

    expect(mockEmit).toHaveBeenCalledOnce();
    expect(mockEmit).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      environmentId: null,
      type: 'flag_archived',
      payload: { key: 'my-flag' },
    });
  });

  it('POST /:flagId/unarchive emits flag_unarchived per environment with full state including rules', async () => {
    mockPrisma.flag.findUnique.mockResolvedValue({
      id: 'flag-1',
      key: 'my-flag',
      projectId: PROJECT_ID,
    } as never);
    mockPrisma.$transaction.mockResolvedValue([] as never);
    mockPrisma.flag.findUniqueOrThrow.mockResolvedValue({
      id: 'flag-1',
      key: 'my-flag',
      name: 'My Flag',
      projectId: PROJECT_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
      states: [
        {
          id: 'state-1',
          status: 'inactive',
          type: 'boolean',
          rollout: 0,
          rules: [],
          environment: { id: 'env-1', name: 'Production' },
        },
        {
          id: 'state-2',
          status: 'inactive',
          type: 'percentage_rollout',
          rollout: 50,
          rules: [{ attribute: 'plan', operator: 'EQ', value: ['pro'] }],
          environment: { id: 'env-2', name: 'Staging' },
        },
      ],
    } as never);

    await app.request(`/projects/${PROJECT_ID}/flags/flag-1/unarchive`, {
      method: 'POST',
      headers: bearer(ownerToken(PROJECT_ID)),
    });

    expect(mockEmit).toHaveBeenCalledTimes(2);
    expect(mockEmit).toHaveBeenNthCalledWith(1, {
      projectId: PROJECT_ID,
      environmentId: 'env-1',
      type: 'flag_unarchived',
      payload: {
        key: 'my-flag',
        enabled: false,
        type: 'boolean',
        rollout: 0,
        rules: [],
      },
    });
    expect(mockEmit).toHaveBeenNthCalledWith(2, {
      projectId: PROJECT_ID,
      environmentId: 'env-2',
      type: 'flag_unarchived',
      payload: {
        key: 'my-flag',
        enabled: false,
        type: 'percentage_rollout',
        rollout: 50,
        rules: [{ attribute: 'plan', operator: 'EQ', value: ['pro'] }],
      },
    });
  });

  it('DELETE /:flagId emits flag_deleted', async () => {
    mockPrisma.flag.findUnique.mockResolvedValue({
      id: 'flag-1',
      key: 'my-flag',
      projectId: PROJECT_ID,
    } as never);
    mockPrisma.flag.delete.mockResolvedValue({} as never);

    await app.request(`/projects/${PROJECT_ID}/flags/flag-1`, {
      method: 'DELETE',
      headers: bearer(ownerToken(PROJECT_ID)),
    });

    expect(mockEmit).toHaveBeenCalledOnce();
    expect(mockEmit).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      environmentId: null,
      type: 'flag_deleted',
      payload: { key: 'my-flag' },
    });
  });

  it('PATCH /:flagId (rename) does not emit any event', async () => {
    mockPrisma.flag.findUnique.mockResolvedValue({
      id: 'flag-1',
      key: 'my-flag',
      name: 'Old Name',
      projectId: PROJECT_ID,
    } as never);
    mockPrisma.$transaction.mockResolvedValue([
      {
        id: 'flag-1',
        key: 'my-flag',
        name: 'New Name',
        projectId: PROJECT_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as never);

    await app.request(`/projects/${PROJECT_ID}/flags/flag-1`, {
      method: 'PATCH',
      headers: {
        ...bearer(ownerToken(PROJECT_ID)),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'New Name' }),
    });

    expect(mockEmit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /:flagId/audit-log
// ---------------------------------------------------------------------------
describe('GET /projects/:projectId/flags/:flagId/audit-log', () => {
  const makeEvent = (n: number) => ({
    id: `audit-${n}`,
    action: 'flag.created',
    meta: {},
    createdAt: new Date(),
    user: { id: 'user-owner', name: 'Owner' },
  });

  it('returns events with total/page/limit for default page=1&limit=25', async () => {
    const events = Array.from({ length: 3 }, (_, i) => makeEvent(i + 1));
    mockPrisma.auditEvent.findMany.mockResolvedValue(events as never);
    mockPrisma.auditEvent.count.mockResolvedValue(3 as never);

    const res = await app.request(
      `/projects/${PROJECT_ID}/flags/flag-1/audit-log`,
      { headers: bearer(viewerToken(PROJECT_ID)) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(3);
    expect(body.total).toBe(3);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(25);
    expect(body.items[0]).toMatchObject({
      id: 'audit-1',
      action: 'flag.created',
      userId: 'user-owner',
      userName: 'Owner',
    });
  });

  it('uses page=2 to compute correct skip via parsePaginationParams', async () => {
    mockPrisma.auditEvent.findMany.mockResolvedValue([] as never);
    mockPrisma.auditEvent.count.mockResolvedValue(60 as never);

    const res = await app.request(
      `/projects/${PROJECT_ID}/flags/flag-1/audit-log?page=2&limit=25`,
      { headers: bearer(viewerToken(PROJECT_ID)) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.page).toBe(2);
    expect(body.limit).toBe(25);
    expect(mockPrisma.auditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 25, take: 25 }),
    );
  });

  it('returns 401 without auth', async () => {
    const res = await app.request(
      `/projects/${PROJECT_ID}/flags/flag-1/audit-log`,
    );
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /:flagId — no auditLog field
// ---------------------------------------------------------------------------
describe('GET /:flagId no longer includes auditLog', () => {
  it('does not include auditLog in the response', async () => {
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
          type: 'boolean',
          rollout: 0,
          rules: [],
          environment: { id: 'env-1', name: 'production' },
          status: 'active',
        },
      ],
    } as never);

    const res = await app.request(`/projects/${PROJECT_ID}/flags/flag-1`, {
      headers: bearer(viewerToken(PROJECT_ID)),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flag).not.toHaveProperty('auditLog');
  });
});

// ---------------------------------------------------------------------------
// Write-path: environmentName in audit events
// ---------------------------------------------------------------------------
describe('flag.toggled write-path includes environmentName', () => {
  it('includes environmentName in the audit event meta when toggling', async () => {
    mockPrisma.flagState.findUnique.mockResolvedValue({
      id: 'state-1',
      flagId: 'flag-1',
      environmentId: 'env-1',
      status: 'inactive',
      type: 'boolean',
      rollout: 0,
      flag: { projectId: PROJECT_ID, key: 'my-flag' },
      environment: { id: 'env-1', name: 'production' },
    } as never);
    mockPrisma.$transaction.mockResolvedValue([
      {
        id: 'state-1',
        flagId: 'flag-1',
        environmentId: 'env-1',
        status: 'active',
        type: 'boolean',
        rollout: 0,
        rules: [],
      },
    ] as never);

    await app.request(
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

    const transactionArgs = mockPrisma.$transaction.mock
      .calls[0]?.[0] as unknown[];
    expect(transactionArgs).toBeDefined();
    expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'flag.toggled',
          meta: expect.objectContaining({ environmentName: 'production' }),
        }),
      }),
    );
  });
});

describe('flag.rollout_updated write-path includes environmentName', () => {
  it('includes environmentName in the audit event meta when updating rollout', async () => {
    mockPrisma.flagState.findUnique.mockResolvedValue({
      id: 'state-1',
      flagId: 'flag-1',
      environmentId: 'env-1',
      status: 'active',
      type: 'boolean',
      rollout: 0,
      flag: { projectId: PROJECT_ID, key: 'my-flag' },
      environment: { id: 'env-1', name: 'production' },
    } as never);
    mockPrisma.$transaction.mockResolvedValue([
      {
        id: 'state-1',
        flagId: 'flag-1',
        environmentId: 'env-1',
        status: 'active',
        type: 'percentage_rollout',
        rollout: 40,
        rules: [],
      },
    ] as never);

    await app.request(
      `/projects/${PROJECT_ID}/flags/flag-1/environments/env-1`,
      {
        method: 'PATCH',
        headers: {
          ...bearer(ownerToken(PROJECT_ID)),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'percentage_rollout', rollout: 40 }),
      },
    );

    expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'flag.rollout_updated',
          meta: expect.objectContaining({ environmentName: 'production' }),
        }),
      }),
    );
  });
});
