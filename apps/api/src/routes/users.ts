import type { AuthJwtClaims } from '@repo/auth';
import { isSdkClaims } from '@repo/auth';
import { SYSTEM_ROLE } from '@repo/auth/roles';
import { prisma } from '@repo/prisma';
import { Hono } from 'hono';

import type { ApiAuthVariables } from '../auth/middleware.js';
import { Forbidden } from '../exceptions/index.js';

type AppEnv = { Variables: ApiAuthVariables };

const requireOwnerClaims = (auth: AuthJwtClaims): { userId: string } | null => {
  if (isSdkClaims(auth)) return null;
  if (auth.systemRole !== SYSTEM_ROLE.OWNER) return null;
  return { userId: auth.userId };
};

export const usersRouter = new Hono<AppEnv>();

usersRouter.get('/', async (c) => {
  const auth = c.get('auth');
  const claims = requireOwnerClaims(auth);
  if (!claims) return new Forbidden().toResponse();

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { createdAt: 'asc' },
  });

  return c.json({ users });
});
