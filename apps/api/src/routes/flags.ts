import { TargetingRuleSchema } from '@repo/api';
import type { AuthJwtClaims, ProjectJwtClaims } from '@repo/auth';
import { isSdkClaims } from '@repo/auth';
import { PROJECT_ROLE } from '@repo/auth/roles';
import { buildPrismaPage, parsePaginationParams } from '@repo/pagination';
import { prisma } from '@repo/prisma';
import { Schema } from 'effect';
import { Hono } from 'hono';

import type { ApiAuthVariables } from '../auth/middleware.js';
import { emitFlagEvent } from '../events/emitter.js';
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
  InvalidFlagType,
  InvalidRollout,
  RequestValidationFailed,
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

  emitFlagEvent({
    projectId: claims.projectId,
    environmentId: null,
    type: 'flag_archived',
    payload: { key: flag.key },
  });

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

  for (const state of updated.states) {
    emitFlagEvent({
      projectId: claims.projectId,
      environmentId: state.environment.id,
      type: 'flag_unarchived',
      payload: {
        key: flag.key,
        enabled: false,
        type: state.type,
        rollout: state.rollout,
        rules: Array.isArray(state.rules) ? (state.rules as unknown[]) : [],
      },
    });
  }

  return c.json({ flag: updated });
});

flagsRouter.patch('/:flagId/environments/:environmentId', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();
  if (!canManage(claims)) return new Forbidden().toResponse();

  const { flagId, environmentId } = c.req.param();
  const body = await parseBody(c.req.raw);
  const { status, type, rollout, rules } = body;

  if (
    status === undefined &&
    type === undefined &&
    rollout === undefined &&
    rules === undefined
  ) {
    return new InvalidFlagStatus().toResponse();
  }

  if (status !== undefined && status !== 'active' && status !== 'inactive') {
    return new InvalidFlagStatus().toResponse();
  }

  if (
    type !== undefined &&
    type !== 'boolean' &&
    type !== 'percentage_rollout' &&
    type !== 'targeted'
  ) {
    return new InvalidFlagType().toResponse();
  }

  if (
    rollout !== undefined &&
    (typeof rollout !== 'number' ||
      !Number.isInteger(rollout) ||
      rollout < 0 ||
      rollout > 100)
  ) {
    return new InvalidRollout().toResponse();
  }

  let validatedRules: Record<string, unknown>[] | undefined;
  if (rules !== undefined) {
    try {
      const decoded = Schema.decodeUnknownSync(
        Schema.Array(TargetingRuleSchema),
      )(rules);
      validatedRules = decoded as unknown as Record<string, unknown>[];
    } catch {
      return new RequestValidationFailed().toResponse();
    }
  }

  const flagState = await prisma.flagState.findUnique({
    where: { flagId_environmentId: { flagId, environmentId } },
    include: {
      flag: { select: { projectId: true, key: true } },
      environment: { select: { id: true, name: true } },
    },
  });

  if (!flagState || flagState.flag.projectId !== claims.projectId) {
    return new FlagNotFound().toResponse();
  }

  if (flagState.status === 'archived') {
    return new FlagIsArchived().toResponse();
  }

  const updateData: Record<string, unknown> = {};
  if (status !== undefined) updateData['status'] = status;
  if (type !== undefined) updateData['type'] = type;
  if (rollout !== undefined) updateData['rollout'] = rollout;
  if (validatedRules !== undefined) updateData['rules'] = validatedRules;

  const isRolloutChange = type !== undefined || rollout !== undefined;
  const finalType = (type as string | undefined) ?? flagState.type;
  const finalRollout = (rollout as number | undefined) ?? flagState.rollout;

  const environmentName = flagState.environment.name;

  const auditEvents = [
    prisma.auditEvent.create({
      data: {
        flagId,
        userId: claims.userId,
        action: isRolloutChange ? 'flag.rollout_updated' : 'flag.toggled',
        meta: isRolloutChange
          ? {
              environmentId,
              environmentName,
              type: finalType,
              rollout: finalRollout,
            }
          : { environmentId, environmentName, status },
      },
    }),
  ];

  if (validatedRules !== undefined) {
    auditEvents.push(
      prisma.auditEvent.create({
        data: {
          flagId,
          userId: claims.userId,
          action: 'flag.rules_updated',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          meta: JSON.parse(
            JSON.stringify({ environmentId, rules: validatedRules }),
          ),
        },
      }),
    );
  }

  const [updated] = await prisma.$transaction([
    prisma.flagState.update({
      where: { flagId_environmentId: { flagId, environmentId } },
      data: updateData,
    }),
    ...auditEvents,
  ]);

  const updatedRules = validatedRules ?? (flagState.rules as unknown[]);

  emitFlagEvent({
    projectId: claims.projectId,
    environmentId,
    type: 'flag_updated',
    payload: {
      key: flagState.flag.key,
      enabled: updated.status === 'active',
      type: updated.type,
      rollout: updated.rollout,
      rules: updatedRules,
    },
  });

  return c.json({ flagState: updated });
});

flagsRouter.get('/:flagId/audit-log', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();

  const { flagId } = c.req.param();
  const { page, limit } = parsePaginationParams(
    Object.fromEntries(new URL(c.req.url).searchParams),
    { limit: 25 },
  );
  const { skip, take } = buildPrismaPage(page, limit);

  const [events, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where: { flagId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.auditEvent.count({ where: { flagId } }),
  ]);

  return c.json({
    events: events.map((e) => ({
      id: e.id,
      action: e.action,
      meta: e.meta,
      createdAt: e.createdAt,
      userId: e.user.id,
      userName: e.user.name,
    })),
    total,
    page,
    limit,
  });
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
        type: s.type,
        rollout: s.rollout,
        rules: Array.isArray(s.rules) ? s.rules : [],
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

  emitFlagEvent({
    projectId: claims.projectId,
    environmentId: null,
    type: 'flag_deleted',
    payload: { key: flag.key },
  });

  return new Response(null, { status: 204 });
});

const FLAG_STATUS_VALUES = ['active', 'inactive', 'archived'] as const;

flagsRouter.get('/', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();

  const environmentId = c.req.query('environmentId');
  if (!environmentId) {
    return new EnvironmentIdRequired().toResponse();
  }

  const { page, limit } = parsePaginationParams(
    Object.fromEntries(new URL(c.req.url).searchParams),
  );
  const { skip, take } = buildPrismaPage(page, limit);

  const search = c.req.query('search')?.trim() ?? '';
  const statusParam = c.req.query('status') ?? 'all';
  const status = FLAG_STATUS_VALUES.find((s) => s === statusParam);

  const where = {
    projectId: claims.projectId,
    states: {
      some: { environmentId, ...(status ? { status } : {}) },
    },
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { key: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [flagsWithStates, total] = await Promise.all([
    prisma.flag.findMany({
      where,
      include: {
        states: {
          where: { environmentId },
          select: { status: true, type: true, rollout: true },
        },
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take,
    }),
    prisma.flag.count({ where }),
  ]);

  const flags = flagsWithStates.map((flag) => ({
    id: flag.id,
    key: flag.key,
    name: flag.name,
    status: flag.states[0]?.status ?? 'inactive',
    type: flag.states[0]?.type ?? 'boolean',
    rollout: flag.states[0]?.rollout ?? 0,
    createdAt: flag.createdAt,
    updatedAt: flag.updatedAt,
  }));

  return c.json({ flags, total, page, limit });
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

  emitFlagEvent({
    projectId: claims.projectId,
    environmentId: null,
    type: 'flag_created',
    payload: { key, enabled: false, type: 'boolean', rollout: 0 },
  });

  return c.json({ flag }, 201);
});
