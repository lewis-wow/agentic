import {
  ApiKeyIdParamSchema,
  ApiKeyListItemFromPrisma,
  ApiKeyListPageSchema,
  ApiKeyListQuerySchema,
  CreateApiKeyRequestSchema,
  CreateApiKeyResponseFromPrisma,
  RevokeApiKeyResponseFromPrisma,
  RotateApiKeyResponseSchema,
} from '@repo/api';
import {
  ApiKeyAlreadyRevoked,
  ApiKeyNotFound,
  EnvironmentNotFound,
  Forbidden,
} from '@repo/api/exceptions';
import { canManageProject, requireProjectClaims } from '@repo/auth';
import { generateApiKey } from '@repo/auth/api-key';
import { buildPrismaPage, parsePaginationParams } from '@repo/pagination';
import { prisma } from '@repo/prisma';
import { Schema } from 'effect';
import { Hono } from 'hono';

import type { ApiAuthVariables } from '../auth/middleware.js';
import { validate } from '../validation.js';

type AppEnv = { Variables: ApiAuthVariables };

export const apiKeysRouter = new Hono<AppEnv>();

apiKeysRouter.get('/', validate('query', ApiKeyListQuerySchema), async (c) => {
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

  const [apiKeys, total] = await prisma.$transaction([
    prisma.apiKey.findMany({
      where,
      include: { environment: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.apiKey.count({ where }),
  ]);

  const encoded = Schema.encodeSync(ApiKeyListPageSchema)({
    items: apiKeys.map((key) =>
      Schema.decodeUnknownSync(ApiKeyListItemFromPrisma)(key),
    ),
    total,
    page,
    limit,
  });
  return c.json(encoded);
});

apiKeysRouter.post(
  '/',
  validate('json', CreateApiKeyRequestSchema),
  async (c) => {
    const auth = c.get('auth');
    const claims = requireProjectClaims(auth);
    if (!claims) return new Forbidden().toResponse();
    if (!canManageProject(claims)) return new Forbidden().toResponse();

    const { name, environmentId } = c.req.valid('json');

    const environment = await prisma.environment.findUnique({
      where: { id: environmentId, projectId: claims.projectId },
    });
    if (!environment) return new EnvironmentNotFound().toResponse();

    const { fullKey, apiKeyId, apiKeyHash } = await generateApiKey({
      environmentName: environment.name,
    });

    const apiKey = await prisma.apiKey.create({
      data: { name: name.trim(), apiKeyId, apiKeyHash, environmentId },
    });

    const encoded = Schema.decodeUnknownSync(CreateApiKeyResponseFromPrisma)({
      apiKey: { ...apiKey, environment },
      fullKey,
    });

    return c.json(encoded, 201);
  },
);

apiKeysRouter.post(
  '/:apiKeyId/rotate',
  validate('param', ApiKeyIdParamSchema),
  async (c) => {
    const auth = c.get('auth');
    const claims = requireProjectClaims(auth);
    if (!claims) return new Forbidden().toResponse();
    if (!canManageProject(claims)) return new Forbidden().toResponse();

    const { apiKeyId: id } = c.req.valid('param');

    const existing = await prisma.apiKey.findFirst({
      where: { id, environment: { projectId: claims.projectId } },
      include: { environment: { select: { name: true } } },
    });
    if (!existing) return new ApiKeyNotFound().toResponse();
    if (existing.revokedAt) return new ApiKeyAlreadyRevoked().toResponse();

    const { fullKey, apiKeyId, apiKeyHash } = await generateApiKey({
      environmentName: existing.environment.name,
    });

    await prisma.apiKey.update({
      where: { id },
      data: { apiKeyId, apiKeyHash },
    });

    const encoded = Schema.encodeSync(RotateApiKeyResponseSchema)({ fullKey });
    return c.json(encoded);
  },
);

apiKeysRouter.post(
  '/:apiKeyId/revoke',
  validate('param', ApiKeyIdParamSchema),
  async (c) => {
    const auth = c.get('auth');
    const claims = requireProjectClaims(auth);
    if (!claims) return new Forbidden().toResponse();
    if (!canManageProject(claims)) return new Forbidden().toResponse();

    const { apiKeyId: id } = c.req.valid('param');

    const existing = await prisma.apiKey.findFirst({
      where: { id, environment: { projectId: claims.projectId } },
    });
    if (!existing) return new ApiKeyNotFound().toResponse();
    if (existing.revokedAt) return new ApiKeyAlreadyRevoked().toResponse();

    const apiKey = await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    const encoded = Schema.decodeUnknownSync(RevokeApiKeyResponseFromPrisma)({
      apiKey,
    });
    return c.json(encoded);
  },
);

apiKeysRouter.delete(
  '/:apiKeyId',
  validate('param', ApiKeyIdParamSchema),
  async (c) => {
    const auth = c.get('auth');
    const claims = requireProjectClaims(auth);
    if (!claims) return new Forbidden().toResponse();
    if (!canManageProject(claims)) return new Forbidden().toResponse();

    const { apiKeyId: id } = c.req.valid('param');

    const result = await prisma.apiKey.deleteMany({
      where: { id, environment: { projectId: claims.projectId } },
    });
    if (result.count === 0) return new ApiKeyNotFound().toResponse();

    return new Response(null, { status: 204 });
  },
);
