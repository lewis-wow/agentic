import { UserListPageSchema, UserListQuerySchema } from '@repo/api';
import { Forbidden } from '@repo/api/exceptions';
import type { AuthJwtClaims } from '@repo/auth';
import { isSdkClaims } from '@repo/auth';
import { SYSTEM_ROLE } from '@repo/auth/roles';
import { buildPrismaPage, parsePaginationParams } from '@repo/pagination';
import { prisma } from '@repo/prisma';
import type { Prisma } from '@repo/prisma';
import { Schema } from 'effect';
import { Hono } from 'hono';

import type { ApiAuthVariables } from '../auth/middleware.js';
import { validate } from '../validation.js';

type AppEnv = { Variables: ApiAuthVariables };

const requireOwnerClaims = (auth: AuthJwtClaims): { userId: string } | null => {
  if (isSdkClaims(auth)) return null;
  if (auth.systemRole !== SYSTEM_ROLE.OWNER) return null;
  return { userId: auth.userId };
};

export const usersRouter = new Hono<AppEnv>();

usersRouter.get('/', validate('query', UserListQuerySchema), async (c) => {
  const auth = c.get('auth');
  const claims = requireOwnerClaims(auth);
  if (!claims) return new Forbidden().toResponse();

  const { page, limit } = parsePaginationParams(
    Object.fromEntries(new URL(c.req.url).searchParams),
  );
  const { skip, take } = buildPrismaPage(page, limit);

  const { search: searchParam } = c.req.valid('query');
  const search = searchParam?.trim() ?? '';
  const where: Prisma.UserWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true },
      orderBy: { createdAt: 'asc' },
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);

  const encoded = Schema.encodeSync(UserListPageSchema)({
    items: users,
    total,
    page,
    limit,
  });
  return c.json(encoded);
});
