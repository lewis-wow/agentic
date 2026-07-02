import { CreateProjectRequestSchema } from '@repo/api';
import type { AuthJwtClaims, MeJwtClaims, ProjectJwtClaims } from '@repo/auth';
import { isSdkClaims } from '@repo/auth';
import { PROJECT_ROLE, SYSTEM_ROLE } from '@repo/auth/roles';
import { prisma } from '@repo/prisma';
import { Either, Schema } from 'effect';
import { Hono } from 'hono';

import type { ApiAuthVariables } from '../auth/middleware.js';
import {
  Forbidden,
  ProjectNameRequired,
  ProjectNotFound,
} from '../exceptions/index.js';

type AppEnv = { Variables: ApiAuthVariables };

const requireUserClaims = (
  auth: AuthJwtClaims,
): Pick<MeJwtClaims, 'userId' | 'systemRole'> | null => {
  if (isSdkClaims(auth)) return null;
  return { userId: auth.userId, systemRole: auth.systemRole };
};

const requireProjectClaims = (auth: AuthJwtClaims): ProjectJwtClaims | null => {
  if (!('userId' in auth) || !('projectId' in auth)) return null;
  if (isSdkClaims(auth)) return null;
  return auth as ProjectJwtClaims;
};

const parseBody = async (
  request: Request,
): Promise<Record<string, unknown>> => {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
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

  return c.json({ projects });
});

projectsRouter.post('/', async (c) => {
  const auth = c.get('auth');
  const claims = requireUserClaims(auth);
  if (!claims) return new Forbidden().toResponse();
  if (claims.systemRole !== SYSTEM_ROLE.OWNER)
    return new Forbidden().toResponse();

  const body = await parseBody(c.req.raw);
  const decoded = Schema.decodeUnknownEither(CreateProjectRequestSchema)(body);
  if (Either.isLeft(decoded)) {
    return new ProjectNameRequired().toResponse();
  }

  const project = await prisma.project.create({
    data: { name: decoded.right.name.trim() },
  });

  return c.json({ project }, 201);
});

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

  return c.json({
    project: {
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      environments: project.environments.map((e) => ({
        id: e.id,
        name: e.name,
        apiKeyId: e.apiKeyId,
      })),
      members: project.members.map((m) => ({
        id: m.id,
        role: m.role,
        user: m.user,
      })),
      owner,
    },
  });
});

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
