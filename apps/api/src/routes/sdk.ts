import { FlagSnapshotResponseSchema } from '@repo/api';
import { isSdkClaims } from '@repo/auth';
import { prisma } from '@repo/prisma';
import { Schema } from 'effect';
import { Hono } from 'hono';

import type { ApiAuthVariables } from '../auth/middleware.js';
import { Forbidden } from '../exceptions/index.js';

type AppEnv = { Variables: ApiAuthVariables };

export const sdkRouter = new Hono<AppEnv>();

sdkRouter.get('/flags', async (c) => {
  const auth = c.get('auth');
  if (!isSdkClaims(auth)) return new Forbidden().toResponse();

  const flagsWithStates = await prisma.flag.findMany({
    where: { projectId: auth.projectId },
    include: {
      states: {
        where: { environmentId: auth.environmentId },
        select: { status: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const flags = flagsWithStates
    .filter((flag) => flag.states[0]?.status !== 'archived')
    .map((flag) => ({
      key: flag.key,
      enabled: flag.states[0]?.status === 'active',
    }));

  const encoded = Schema.encodeSync(FlagSnapshotResponseSchema)({ flags });

  return c.json(encoded);
});
