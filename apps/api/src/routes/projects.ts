import {
  CreateProjectRequestSchema,
  ProjectDetailFromPrisma,
  ProjectFromPrisma,
  ProjectListItemFromPrisma,
  RenameProjectRequestSchema,
} from '@repo/api';
import type { AuthJwtClaims, MeJwtClaims } from '@repo/auth';
import {
  canManageProject,
  isSdkClaims,
  requireProjectClaims,
} from '@repo/auth';
import { PROJECT_ROLE, SYSTEM_ROLE } from '@repo/auth/roles';
import { prisma } from '@repo/prisma';
import { Schema } from 'effect';
import { Hono } from 'hono';

import type { ApiAuthVariables } from '../auth/middleware.js';
import { Forbidden, ProjectNotFound } from '../exceptions/index.js';
import { validate } from '../validation.js';

type AppEnv = { Variables: ApiAuthVariables };

const requireUserClaims = (
  auth: AuthJwtClaims,
): Pick<MeJwtClaims, 'userId' | 'systemRole'> | null => {
  if (isSdkClaims(auth)) return null;
  return { userId: auth.userId, systemRole: auth.systemRole };
};

export const projectsRouter = new Hono<AppEnv>();

projectsRouter.get('/', async (c) => {
  const auth = c.get('auth');
  const claims = requireUserClaims(auth);
  if (!claims) return new Forbidden().toResponse();

  const environmentsInclude = {
    orderBy: { createdAt: 'asc' as const },
    select: { id: true, name: true },
  };

  const projects =
    claims.systemRole === SYSTEM_ROLE.OWNER
      ? await prisma.project.findMany({
          orderBy: { createdAt: 'asc' },
          include: { environments: environmentsInclude },
        })
      : await prisma.project.findMany({
          where: { members: { some: { userId: claims.userId } } },
          orderBy: { createdAt: 'asc' },
          include: { environments: environmentsInclude },
        });

  const encoded = projects.map((project) =>
    Schema.decodeUnknownSync(ProjectListItemFromPrisma)(project),
  );

  return c.json({ projects: encoded });
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

    const project = await prisma.project.create({
      data: { name: name.trim() },
    });

    const encoded = Schema.decodeUnknownSync(ProjectFromPrisma)(project);
    return c.json({ project: encoded }, 201);
  },
);

projectsRouter.get('/:projectId', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();

  const project = await prisma.project.findUnique({
    where: { id: claims.projectId },
    include: {
      environments: { orderBy: { createdAt: 'asc' } },
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!project) return new ProjectNotFound().toResponse();

  const owner = await prisma.user.findFirst({
    where: { role: SYSTEM_ROLE.OWNER },
    select: { id: true, name: true, email: true },
  });

  const encoded = Schema.decodeUnknownSync(ProjectDetailFromPrisma)({
    ...project,
    owner,
  });

  return c.json({ project: encoded });
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

    const existing = await prisma.project.findUnique({
      where: { id: claims.projectId },
    });
    if (!existing) return new ProjectNotFound().toResponse();

    const project = await prisma.project.update({
      where: { id: claims.projectId },
      data: { name: name.trim() },
    });

    const encoded = Schema.decodeUnknownSync(ProjectFromPrisma)(project);
    return c.json({ project: encoded });
  },
);

projectsRouter.delete('/:projectId', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();
  if (claims.projectRole !== PROJECT_ROLE.OWNER) {
    return new Forbidden().toResponse();
  }

  const project = await prisma.project.findUnique({
    where: { id: claims.projectId },
  });
  if (!project) return new ProjectNotFound().toResponse();

  await prisma.project.delete({ where: { id: claims.projectId } });

  return new Response(null, { status: 204 });
});
