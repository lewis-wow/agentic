import {
  CreateProjectRequestSchema,
  RenameProjectRequestSchema,
} from '@repo/api';
import { Forbidden } from '@repo/api/exceptions';
import { ProjectService } from '@repo/api/services';
import type { AuthJwtClaims, MeJwtClaims } from '@repo/auth';
import {
  canManageProject,
  isSdkClaims,
  requireProjectClaims,
} from '@repo/auth';
import { PROJECT_ROLE, SYSTEM_ROLE } from '@repo/auth/roles';
import { prisma } from '@repo/prisma';
import { Hono } from 'hono';

import type { ApiAuthVariables } from '../auth/middleware.js';
import { validate } from '../validation.js';

type AppEnv = { Variables: ApiAuthVariables };

const requireUserClaims = (
  auth: AuthJwtClaims,
): Pick<MeJwtClaims, 'userId' | 'systemRole'> | null => {
  if (isSdkClaims(auth)) return null;
  return { userId: auth.userId, systemRole: auth.systemRole };
};

const projectService = new ProjectService({ prisma });

export const projectsRouter = new Hono<AppEnv>();

projectsRouter.get('/', async (c) => {
  const auth = c.get('auth');
  const claims = requireUserClaims(auth);
  if (!claims) return new Forbidden().toResponse();

  const result = await projectService.list({
    userId: claims.userId,
    systemRole: claims.systemRole,
  });

  return c.json(result);
});

projectsRouter.post(
  '/',
  validate('json', CreateProjectRequestSchema),
  async (c) => {
    const auth = c.get('auth');
    const claims = requireUserClaims(auth);
    if (!claims) return new Forbidden().toResponse();
    if (claims.systemRole !== SYSTEM_ROLE.OWNER)
      return new Forbidden().toResponse();

    const { name } = c.req.valid('json');

    const result = await projectService.create({ name });

    return c.json(result, 201);
  },
);

projectsRouter.get('/:projectId', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();

  const result = await projectService.get({ projectId: claims.projectId });

  return c.json(result);
});

projectsRouter.patch(
  '/:projectId',
  validate('json', RenameProjectRequestSchema),
  async (c) => {
    const auth = c.get('auth');
    const claims = requireProjectClaims(auth);
    if (!claims) return new Forbidden().toResponse();
    if (!canManageProject(claims)) return new Forbidden().toResponse();

    const { name } = c.req.valid('json');

    const result = await projectService.rename({
      projectId: claims.projectId,
      name,
    });

    return c.json(result);
  },
);

projectsRouter.delete('/:projectId', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();
  if (claims.projectRole !== PROJECT_ROLE.OWNER) {
    return new Forbidden().toResponse();
  }

  await projectService.remove({ projectId: claims.projectId });

  return new Response(null, { status: 204 });
});
