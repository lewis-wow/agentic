import { CreateEnvironmentRequestSchema } from '@repo/api';
import type { AuthJwtClaims, ProjectJwtClaims } from '@repo/auth';
import { isSdkClaims } from '@repo/auth';
import { generateApiKey } from '@repo/auth/api-key';
import { PROJECT_ROLE } from '@repo/auth/roles';
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

export const environmentsRouter = new Hono<AppEnv>();

environmentsRouter.post('/', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();
  if (!canManage(claims)) return new Forbidden().toResponse();

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

  const { fullKey, apiKeyId, apiKeyHash } = await generateApiKey();

  const environment = await prisma.environment.create({
    data: {
      name: trimmedName,
      projectId: claims.projectId,
      apiKeyId,
      apiKeyHash,
    },
  });

  return c.json(
    {
      environment: {
        id: environment.id,
        name: environment.name,
        apiKeyId: environment.apiKeyId,
      },
      fullKey,
    },
    201,
  );
});

environmentsRouter.delete('/:environmentId', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();
  if (!canManage(claims)) return new Forbidden().toResponse();

  const { environmentId } = c.req.param();

  const result = await prisma.environment.deleteMany({
    where: { id: environmentId, projectId: claims.projectId },
  });
  if (result.count === 0) return new EnvironmentNotFound().toResponse();

  return new Response(null, { status: 204 });
});

environmentsRouter.post('/:environmentId/rotate-key', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();
  if (!canManage(claims)) return new Forbidden().toResponse();

  const { environmentId } = c.req.param();

  const existing = await prisma.environment.findUnique({
    where: { id: environmentId, projectId: claims.projectId },
  });
  if (!existing) return new EnvironmentNotFound().toResponse();

  const { fullKey, apiKeyId, apiKeyHash } = await generateApiKey();

  await prisma.environment.update({
    where: { id: environmentId },
    data: { apiKeyId, apiKeyHash },
  });

  return c.json({ fullKey });
});
