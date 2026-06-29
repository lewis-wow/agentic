import type { AuthJwtClaims, ProjectJwtClaims } from '@repo/auth';
import { isSdkClaims } from '@repo/auth';
import { PROJECT_ROLE } from '@repo/auth/roles';
import { prisma } from '@repo/prisma';
import { Hono } from 'hono';

import type { ApiAuthVariables } from '../auth/middleware.js';
import {
  EnvironmentIdRequired,
  FlagIsArchived,
  FlagKeyConflict,
  FlagKeyRequired,
  FlagNameRequired,
  FlagNotFound,
  Forbidden,
  InvalidFlagKey,
  InvalidFlagStatus,
} from '../exceptions/index.js';

type AppEnv = { Variables: ApiAuthVariables };

const FLAG_KEY_RE = /^[a-z0-9-]+$/;

const requireProjectClaims = (auth: AuthJwtClaims): ProjectJwtClaims | null => {
  if (!('userId' in auth) || !('projectId' in auth)) return null;
  if (isSdkClaims(auth)) return null;
  return auth as ProjectJwtClaims;
};

const canManage = (claims: ProjectJwtClaims): boolean =>
  claims.projectRole === PROJECT_ROLE.OWNER ||
  claims.projectRole === PROJECT_ROLE.ADMIN;

const parseBody = async (
  request: Request,
): Promise<Record<string, unknown>> => {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
};

export const flagsRouter = new Hono<AppEnv>();

flagsRouter.get('/environments', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();

  const environments = await prisma.environment.findMany({
    where: { projectId: claims.projectId },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  return c.json({ environments });
});

flagsRouter.post('/:flagId/archive', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();
  if (!canManage(claims)) return new Forbidden().toResponse();

  const { flagId } = c.req.param();

  const flag = await prisma.flag.findUnique({
    where: { id: flagId, projectId: claims.projectId },
  });
  if (!flag) return new FlagNotFound().toResponse();

  await prisma.$transaction([
    prisma.flagState.updateMany({
      where: { flagId },
      data: { status: 'archived' },
    }),
    prisma.auditEvent.create({
      data: {
        flagId,
        userId: claims.userId,
        action: 'flag.archived',
        meta: {},
      },
    }),
  ]);

  const updated = await prisma.flag.findUniqueOrThrow({
    where: { id: flagId },
    include: {
      states: {
        include: { environment: { select: { id: true, name: true } } },
      },
    },
  });

  return c.json({ flag: updated });
});

flagsRouter.post('/:flagId/unarchive', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();
  if (!canManage(claims)) return new Forbidden().toResponse();

  const { flagId } = c.req.param();

  const flag = await prisma.flag.findUnique({
    where: { id: flagId, projectId: claims.projectId },
  });
  if (!flag) return new FlagNotFound().toResponse();

  await prisma.$transaction([
    prisma.flagState.updateMany({
      where: { flagId },
      data: { status: 'inactive' },
    }),
    prisma.auditEvent.create({
      data: {
        flagId,
        userId: claims.userId,
        action: 'flag.unarchived',
        meta: {},
      },
    }),
  ]);

  const updated = await prisma.flag.findUniqueOrThrow({
    where: { id: flagId },
    include: {
      states: {
        include: { environment: { select: { id: true, name: true } } },
      },
    },
  });

  return c.json({ flag: updated });
});

flagsRouter.patch('/:flagId/environments/:environmentId', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();
  if (!canManage(claims)) return new Forbidden().toResponse();

  const { flagId, environmentId } = c.req.param();
  const body = await parseBody(c.req.raw);
  const { status } = body;

  if (status !== 'active' && status !== 'inactive') {
    return new InvalidFlagStatus().toResponse();
  }

  const flagState = await prisma.flagState.findUnique({
    where: { flagId_environmentId: { flagId, environmentId } },
    include: { flag: { select: { projectId: true } } },
  });

  if (!flagState || flagState.flag.projectId !== claims.projectId) {
    return new FlagNotFound().toResponse();
  }

  if (flagState.status === 'archived') {
    return new FlagIsArchived().toResponse();
  }

  const [updated] = await prisma.$transaction([
    prisma.flagState.update({
      where: { flagId_environmentId: { flagId, environmentId } },
      data: { status },
    }),
    prisma.auditEvent.create({
      data: {
        flagId,
        userId: claims.userId,
        action: 'flag.toggled',
        meta: { environmentId, status },
      },
    }),
  ]);

  return c.json({ flagState: updated });
});

flagsRouter.get('/:flagId', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();

  const { flagId } = c.req.param();

  const flag = await prisma.flag.findUnique({
    where: { id: flagId, projectId: claims.projectId },
    include: {
      states: {
        include: {
          environment: { select: { id: true, name: true } },
        },
        orderBy: { environment: { createdAt: 'asc' } },
      },
      auditLog: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  if (!flag) return new FlagNotFound().toResponse();

  return c.json({
    flag: {
      id: flag.id,
      key: flag.key,
      name: flag.name,
      createdAt: flag.createdAt,
      updatedAt: flag.updatedAt,
      states: flag.states.map((s) => ({
        id: s.id,
        environmentId: s.environment.id,
        environmentName: s.environment.name,
        status: s.status,
      })),
      auditLog: flag.auditLog.map((e) => ({
        id: e.id,
        action: e.action,
        meta: e.meta,
        createdAt: e.createdAt,
        userId: e.user.id,
        userName: e.user.name,
      })),
    },
  });
});

flagsRouter.patch('/:flagId', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();
  if (!canManage(claims)) return new Forbidden().toResponse();

  const { flagId } = c.req.param();
  const body = await parseBody(c.req.raw);
  const { name } = body;

  if (!name || typeof name !== 'string') {
    return new FlagNameRequired().toResponse();
  }

  const existing = await prisma.flag.findUnique({
    where: { id: flagId, projectId: claims.projectId },
  });
  if (!existing) return new FlagNotFound().toResponse();

  const [updated] = await prisma.$transaction([
    prisma.flag.update({ where: { id: flagId }, data: { name } }),
    prisma.auditEvent.create({
      data: {
        flagId,
        userId: claims.userId,
        action: 'flag.renamed',
        meta: { oldName: existing.name, newName: name },
      },
    }),
  ]);

  return c.json({ flag: updated });
});

flagsRouter.delete('/:flagId', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();
  if (!canManage(claims)) return new Forbidden().toResponse();

  const { flagId } = c.req.param();

  const flag = await prisma.flag.findUnique({
    where: { id: flagId, projectId: claims.projectId },
  });
  if (!flag) return new FlagNotFound().toResponse();

  await prisma.flag.delete({ where: { id: flagId } });

  return new Response(null, { status: 204 });
});

flagsRouter.get('/', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();

  const environmentId = c.req.query('environmentId');
  if (!environmentId) {
    return new EnvironmentIdRequired().toResponse();
  }

  const flagsWithStates = await prisma.flag.findMany({
    where: { projectId: claims.projectId },
    include: {
      states: {
        where: { environmentId },
        select: { status: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const flags = flagsWithStates
    .filter((flag) => flag.states[0]?.status !== 'archived')
    .map((flag) => ({
      id: flag.id,
      key: flag.key,
      name: flag.name,
      status: flag.states[0]?.status ?? 'inactive',
      createdAt: flag.createdAt,
      updatedAt: flag.updatedAt,
    }));

  return c.json({ flags });
});

flagsRouter.post('/', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();
  if (!canManage(claims)) return new Forbidden().toResponse();

  const body = await parseBody(c.req.raw);
  const { key, name } = body;

  if (!key || typeof key !== 'string') {
    return new FlagKeyRequired().toResponse();
  }
  if (!name || typeof name !== 'string') {
    return new FlagNameRequired().toResponse();
  }
  if (!FLAG_KEY_RE.test(key)) {
    return new InvalidFlagKey().toResponse();
  }

  const existing = await prisma.flag.findUnique({
    where: { projectId_key: { projectId: claims.projectId, key } },
  });
  if (existing) {
    return new FlagKeyConflict().toResponse();
  }

  const environments = await prisma.environment.findMany({
    where: { projectId: claims.projectId },
    select: { id: true },
  });

  const flag = await prisma.flag.create({
    data: {
      projectId: claims.projectId,
      key,
      name,
      states: {
        create: environments.map((e) => ({
          environmentId: e.id,
          status: 'inactive',
          type: 'boolean',
        })),
      },
      auditLog: {
        create: {
          userId: claims.userId,
          action: 'flag.created',
          meta: { key, name },
        },
      },
    },
  });

  return c.json({ flag }, 201);
});
