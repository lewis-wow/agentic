import {
  EnvironmentIdParamSchema,
  EnvironmentListQuerySchema,
  CreateEnvironmentRequestSchema,
} from '@repo/api';
import { Forbidden } from '@repo/api/exceptions';
import { EnvironmentService } from '@repo/api/services';
import { canManageProject, requireProjectClaims } from '@repo/auth';
import { parsePaginationParams } from '@repo/pagination';
import { prisma } from '@repo/prisma';
import { Hono } from 'hono';

import type { ApiAuthVariables } from '../auth/middleware.js';
import { validate } from '../validation.js';

type AppEnv = { Variables: ApiAuthVariables };

const environmentService = new EnvironmentService({ prisma });

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
    const { search } = c.req.valid('query');

    const encoded = await environmentService.list({
      projectId: claims.projectId,
      search,
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

    const result = await environmentService.create({
      projectId: claims.projectId,
      name,
    });

    return c.json(result, 201);
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

    await environmentService.remove({
      projectId: claims.projectId,
      environmentId,
    });

    return new Response(null, { status: 204 });
  },
);
