import {
  CreateEnvironmentRequestSchema,
  EnvironmentIdParamSchema,
  EnvironmentListPageSchema,
  EnvironmentListQuerySchema,
  EnvironmentSchema,
} from '@repo/api';
import { canManageProject, requireProjectClaims } from '@repo/auth';
import { buildPrismaPage, parsePaginationParams } from '@repo/pagination';
import { prisma } from '@repo/prisma';
import { Schema } from 'effect';
import { Hono } from 'hono';

import type { ApiAuthVariables } from '../auth/middleware.js';
import {
  EnvironmentNameConflict,
  EnvironmentNotFound,
  Forbidden,
} from '../exceptions/index.js';
import { validate } from '../validation.js';

type AppEnv = { Variables: ApiAuthVariables };

export const environmentsRouter = new Hono<AppEnv>();

environmentsRouter.get(
  '/',
  validate('query', EnvironmentListQuerySchema),
  async (c) => {
    const auth = c.get('auth');
    const claims = requireProjectClaims(auth);
    if (!claims) return new Forbidden().toResponse();

    const { page, limit } = parsePaginationParams(
      Object.fromEntries(new URL(c.req.url).searchParams),
    );
    const { skip, take } = buildPrismaPage(page, limit);

    const { search: searchParam } = c.req.valid('query');
    const search = searchParam?.trim() ?? '';
    const where = {
      projectId: claims.projectId,
      ...(search
        ? { name: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };

    const [environments, total] = await Promise.all([
      prisma.environment.findMany({
        where,
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
      prisma.environment.count({ where }),
    ]);

    const encoded = Schema.encodeSync(EnvironmentListPageSchema)({
      items: environments,
      total,
      page,
      limit,
    });
    return c.json(encoded);
  },
);

environmentsRouter.post(
  '/',
  validate('json', CreateEnvironmentRequestSchema),
  async (c) => {
    const auth = c.get('auth');
    const claims = requireProjectClaims(auth);
    if (!claims) return new Forbidden().toResponse();
    if (!canManageProject(claims)) return new Forbidden().toResponse();

    const { name } = c.req.valid('json');
    const trimmedName = name.trim();

    const existing = await prisma.environment.findUnique({
      where: {
        projectId_name: { projectId: claims.projectId, name: trimmedName },
      },
    });
    if (existing) return new EnvironmentNameConflict().toResponse();

    const environment = await prisma.environment.create({
      data: { name: trimmedName, projectId: claims.projectId },
    });

    // `EnvironmentSchema` has no date fields to convert, so decoding the
    // full Prisma row directly (excess columns like `projectId` are dropped
    // automatically) needs no dedicated `*FromPrisma` transform.
    const encoded = Schema.decodeUnknownSync(EnvironmentSchema)(environment);

    return c.json({ environment: encoded }, 201);
  },
);

environmentsRouter.delete(
  '/:environmentId',
  validate('param', EnvironmentIdParamSchema),
  async (c) => {
    const auth = c.get('auth');
    const claims = requireProjectClaims(auth);
    if (!claims) return new Forbidden().toResponse();
    if (!canManageProject(claims)) return new Forbidden().toResponse();

    const { environmentId } = c.req.valid('param');

    const result = await prisma.environment.deleteMany({
      where: { id: environmentId, projectId: claims.projectId },
    });
    if (result.count === 0) return new EnvironmentNotFound().toResponse();

    return new Response(null, { status: 204 });
  },
);
