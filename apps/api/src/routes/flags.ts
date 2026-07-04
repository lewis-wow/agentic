import {
  AuditLogEntryFromPrisma,
  AuditLogPageSchema,
  CreateFlagRequestSchema,
  EnvironmentSchema,
  FlagDetailFromPrisma,
  FlagEnvironmentParamSchema,
  FlagFromPrisma,
  FlagIdParamSchema,
  FlagListItemFromPrisma,
  FlagListPageSchema,
  FlagListQuerySchema,
  FlagStateFromPrisma,
  RenameFlagRequestSchema,
  UpdateFlagStateRequestSchema,
} from '@repo/api';
import { canManageProject, requireProjectClaims } from '@repo/auth';
import { buildPrismaPage, parsePaginationParams } from '@repo/pagination';
import { prisma } from '@repo/prisma';
import { Schema } from 'effect';
import { Hono } from 'hono';

import type { ApiAuthVariables } from '../auth/middleware.js';
import { emitFlagEvent } from '../events/emitter.js';
import {
  FlagIsArchived,
  FlagKeyConflict,
  FlagNotFound,
  Forbidden,
} from '../exceptions/index.js';
import { validate } from '../validation.js';

type AppEnv = { Variables: ApiAuthVariables };

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

  const encoded = environments.map((e) =>
    Schema.encodeSync(EnvironmentSchema)(e),
  );
  return c.json({ environments: encoded });
});

flagsRouter.post(
  '/:flagId/archive',
  validate('param', FlagIdParamSchema),
  async (c) => {
    const auth = c.get('auth');
    const claims = requireProjectClaims(auth);
    if (!claims) return new Forbidden().toResponse();
    if (!canManageProject(claims)) return new Forbidden().toResponse();

    const { flagId } = c.req.valid('param');

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

    const flagDetail = Schema.decodeUnknownSync(FlagDetailFromPrisma)(updated);
    return c.json({ flag: flagDetail });
  },
);

flagsRouter.post(
  '/:flagId/unarchive',
  validate('param', FlagIdParamSchema),
  async (c) => {
    const auth = c.get('auth');
    const claims = requireProjectClaims(auth);
    if (!claims) return new Forbidden().toResponse();
    if (!canManageProject(claims)) return new Forbidden().toResponse();

    const { flagId } = c.req.valid('param');

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

    const flagDetail = Schema.decodeUnknownSync(FlagDetailFromPrisma)(updated);
    return c.json({ flag: flagDetail });
  },
);

flagsRouter.patch(
  '/:flagId/environments/:environmentId',
  validate('param', FlagEnvironmentParamSchema),
  validate('json', UpdateFlagStateRequestSchema),
  async (c) => {
    const auth = c.get('auth');
    const claims = requireProjectClaims(auth);
    if (!claims) return new Forbidden().toResponse();
    if (!canManageProject(claims)) return new Forbidden().toResponse();

    const { flagId, environmentId } = c.req.valid('param');
    const { status, type, rollout, rules } = c.req.valid('json');

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
    if (rules !== undefined) updateData['rules'] = rules;

    const isRolloutChange = type !== undefined || rollout !== undefined;
    const finalType = type ?? flagState.type;
    const finalRollout = rollout ?? flagState.rollout;

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

    if (rules !== undefined) {
      auditEvents.push(
        prisma.auditEvent.create({
          data: {
            flagId,
            userId: claims.userId,
            action: 'flag.rules_updated',
            meta: JSON.parse(JSON.stringify({ environmentId, rules })),
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

    const updatedRules: unknown[] = rules
      ? [...rules]
      : (flagState.rules as unknown[]);

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

    const encodedState = Schema.decodeUnknownSync(FlagStateFromPrisma)({
      ...updated,
      environment: { id: environmentId, name: environmentName },
    });

    return c.json({ flagState: encodedState });
  },
);

flagsRouter.get(
  '/:flagId/audit-log',
  validate('param', FlagIdParamSchema),
  async (c) => {
    const auth = c.get('auth');
    const claims = requireProjectClaims(auth);
    if (!claims) return new Forbidden().toResponse();

    const { flagId } = c.req.valid('param');
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

    const encoded = Schema.encodeSync(AuditLogPageSchema)({
      items: events.map((e) =>
        Schema.decodeUnknownSync(AuditLogEntryFromPrisma)(e),
      ),
      total,
      page,
      limit,
    });
    return c.json(encoded);
  },
);

flagsRouter.get('/:flagId', validate('param', FlagIdParamSchema), async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();

  const { flagId } = c.req.valid('param');

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

  const flagDetail = Schema.decodeUnknownSync(FlagDetailFromPrisma)(flag);
  return c.json({ flag: flagDetail });
});

flagsRouter.patch(
  '/:flagId',
  validate('param', FlagIdParamSchema),
  validate('json', RenameFlagRequestSchema),
  async (c) => {
    const auth = c.get('auth');
    const claims = requireProjectClaims(auth);
    if (!claims) return new Forbidden().toResponse();
    if (!canManageProject(claims)) return new Forbidden().toResponse();

    const { flagId } = c.req.valid('param');
    const { name } = c.req.valid('json');

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

    const flag = Schema.decodeUnknownSync(FlagFromPrisma)(updated);
    return c.json({ flag });
  },
);

flagsRouter.delete(
  '/:flagId',
  validate('param', FlagIdParamSchema),
  async (c) => {
    const auth = c.get('auth');
    const claims = requireProjectClaims(auth);
    if (!claims) return new Forbidden().toResponse();
    if (!canManageProject(claims)) return new Forbidden().toResponse();

    const { flagId } = c.req.valid('param');

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
  },
);

flagsRouter.get('/', validate('query', FlagListQuerySchema), async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();

  const { environmentId, search, status: statusParam } = c.req.valid('query');

  const { page, limit } = parsePaginationParams(
    Object.fromEntries(new URL(c.req.url).searchParams),
  );
  const { skip, take } = buildPrismaPage(page, limit);

  const trimmedSearch = search?.trim() ?? '';
  const status = statusParam && statusParam !== 'all' ? statusParam : undefined;

  const where = {
    projectId: claims.projectId,
    states: {
      some: { environmentId, ...(status ? { status } : {}) },
    },
    ...(trimmedSearch
      ? {
          OR: [
            { name: { contains: trimmedSearch, mode: 'insensitive' as const } },
            { key: { contains: trimmedSearch, mode: 'insensitive' as const } },
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

  const encoded = Schema.encodeSync(FlagListPageSchema)({
    items: flagsWithStates.map((flag) =>
      Schema.decodeUnknownSync(FlagListItemFromPrisma)(flag),
    ),
    total,
    page,
    limit,
  });

  return c.json(encoded);
});

flagsRouter.post('/', validate('json', CreateFlagRequestSchema), async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();
  if (!canManageProject(claims)) return new Forbidden().toResponse();

  const { key, name } = c.req.valid('json');

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

  const encoded = Schema.decodeUnknownSync(FlagFromPrisma)(flag);
  return c.json({ flag: encoded }, 201);
});
