import { CreateEnvironmentRequestSchema } from '@repo/api';
import { canManageProject, requireProjectClaims } from '@repo/auth';
import { buildPrismaPage, parsePaginationParams } from '@repo/pagination';
import { prisma } from '@repo/prisma';
import { Either, Schema } from 'effect';
import { Hono } from 'hono';

import type { ApiAuthVariables } from '../auth/middleware.js';
import {
  EnvironmentNameConflict,
  EnvironmentNameRequired,
  EnvironmentNotFound,
  Forbidden,
} from '../exceptions/index.js';

type AppEnv = { Variables: ApiAuthVariables };

const parseBody = async (
  request: Request,
): Promise<Record<string, unknown>> => {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
};

export const environmentsRouter = new Hono<AppEnv>();

environmentsRouter.get('/', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();

  const { page, limit } = parsePaginationParams(
    Object.fromEntries(new URL(c.req.url).searchParams),
  );
  const { skip, take } = buildPrismaPage(page, limit);

  const search = c.req.query('search')?.trim() ?? '';
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

  return c.json({ environments, total, page, limit });
});

environmentsRouter.post('/', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();
  if (!canManageProject(claims)) return new Forbidden().toResponse();

  const body = await parseBody(c.req.raw);
  const decoded = Schema.decodeUnknownEither(CreateEnvironmentRequestSchema)(
    body,
  );
  if (Either.isLeft(decoded)) {
    return new EnvironmentNameRequired().toResponse();
  }
  const trimmedName = decoded.right.name.trim();

  const existing = await prisma.environment.findUnique({
    where: {
      projectId_name: { projectId: claims.projectId, name: trimmedName },
    },
  });
  if (existing) return new EnvironmentNameConflict().toResponse();

  const environment = await prisma.environment.create({
    data: { name: trimmedName, projectId: claims.projectId },
  });

  return c.json(
    { environment: { id: environment.id, name: environment.name } },
    201,
  );
});

environmentsRouter.delete('/:environmentId', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();
  if (!canManageProject(claims)) return new Forbidden().toResponse();

  const { environmentId } = c.req.param();

  const result = await prisma.environment.deleteMany({
    where: { id: environmentId, projectId: claims.projectId },
  });
  if (result.count === 0) return new EnvironmentNotFound().toResponse();

  return new Response(null, { status: 204 });
});
