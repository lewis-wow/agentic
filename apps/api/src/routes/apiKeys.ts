import { CreateApiKeyRequestSchema } from '@repo/api';
import type { AuthJwtClaims, ProjectJwtClaims } from '@repo/auth';
import { isSdkClaims } from '@repo/auth';
import { generateApiKey } from '@repo/auth/api-key';
import { PROJECT_ROLE } from '@repo/auth/roles';
import { buildPrismaPage, parsePaginationParams } from '@repo/pagination';
import { prisma } from '@repo/prisma';
import { Either, Schema } from 'effect';
import { Hono } from 'hono';

import type { ApiAuthVariables } from '../auth/middleware.js';
import {
  ApiKeyAlreadyRevoked,
  ApiKeyNameRequired,
  ApiKeyNotFound,
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

export const apiKeysRouter = new Hono<AppEnv>();

apiKeysRouter.get('/', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();

  const { page, limit } = parsePaginationParams(
    Object.fromEntries(new URL(c.req.url).searchParams),
  );
  const { skip, take } = buildPrismaPage(page, limit);

  const search = c.req.query('search')?.trim() ?? '';
  const where = {
    environment: { projectId: claims.projectId },
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            {
              environment: {
                name: { contains: search, mode: 'insensitive' as const },
              },
            },
          ],
        }
      : {}),
  };

  const [apiKeys, total] = await Promise.all([
    prisma.apiKey.findMany({
      where,
      include: { environment: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.apiKey.count({ where }),
  ]);

  return c.json({
    apiKeys: apiKeys.map((key) => ({
      id: key.id,
      name: key.name,
      apiKeyId: key.apiKeyId,
      environmentId: key.environment.id,
      environmentName: key.environment.name,
      revokedAt: key.revokedAt,
      createdAt: key.createdAt,
    })),
    total,
    page,
    limit,
  });
});

apiKeysRouter.post('/', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();
  if (!canManage(claims)) return new Forbidden().toResponse();

  const body = await parseBody(c.req.raw);
  const decoded = Schema.decodeUnknownEither(CreateApiKeyRequestSchema)(body);
  if (Either.isLeft(decoded)) {
    return new ApiKeyNameRequired().toResponse();
  }
  const { name, environmentId } = decoded.right;

  const environment = await prisma.environment.findUnique({
    where: { id: environmentId, projectId: claims.projectId },
  });
  if (!environment) return new EnvironmentNotFound().toResponse();

  const { fullKey, apiKeyId, apiKeyHash } = await generateApiKey();

  const apiKey = await prisma.apiKey.create({
    data: { name: name.trim(), apiKeyId, apiKeyHash, environmentId },
  });

  return c.json(
    {
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        apiKeyId: apiKey.apiKeyId,
        environmentId: environment.id,
        environmentName: environment.name,
        revokedAt: apiKey.revokedAt,
        createdAt: apiKey.createdAt,
      },
      fullKey,
    },
    201,
  );
});

apiKeysRouter.post('/:apiKeyId/rotate', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();
  if (!canManage(claims)) return new Forbidden().toResponse();

  const { apiKeyId: id } = c.req.param();

  const existing = await prisma.apiKey.findFirst({
    where: { id, environment: { projectId: claims.projectId } },
  });
  if (!existing) return new ApiKeyNotFound().toResponse();
  if (existing.revokedAt) return new ApiKeyAlreadyRevoked().toResponse();

  const { fullKey, apiKeyId, apiKeyHash } = await generateApiKey();

  await prisma.apiKey.update({
    where: { id },
    data: { apiKeyId, apiKeyHash },
  });

  return c.json({ fullKey });
});

apiKeysRouter.post('/:apiKeyId/revoke', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();
  if (!canManage(claims)) return new Forbidden().toResponse();

  const { apiKeyId: id } = c.req.param();

  const existing = await prisma.apiKey.findFirst({
    where: { id, environment: { projectId: claims.projectId } },
  });
  if (!existing) return new ApiKeyNotFound().toResponse();
  if (existing.revokedAt) return new ApiKeyAlreadyRevoked().toResponse();

  const apiKey = await prisma.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  return c.json({ apiKey: { id: apiKey.id, revokedAt: apiKey.revokedAt } });
});

apiKeysRouter.delete('/:apiKeyId', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();
  if (!canManage(claims)) return new Forbidden().toResponse();

  const { apiKeyId: id } = c.req.param();

  const result = await prisma.apiKey.deleteMany({
    where: { id, environment: { projectId: claims.projectId } },
  });
  if (result.count === 0) return new ApiKeyNotFound().toResponse();

  return new Response(null, { status: 204 });
});
