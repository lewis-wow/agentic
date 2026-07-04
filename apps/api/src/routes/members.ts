import {
  AddableUsersQuerySchema,
  AddableUsersResponseSchema,
  AddMemberRequestSchema,
  MemberIdParamSchema,
  MemberListItemSchema,
  MemberListPageSchema,
  MemberListQuerySchema,
} from '@repo/api';
import {
  CannotAddOwnerAsMember,
  Forbidden,
  MemberNotFound,
  UserNotFound,
} from '@repo/api/exceptions';
import { canManageProject, requireProjectClaims } from '@repo/auth';
import { SYSTEM_ROLE } from '@repo/auth/roles';
import { buildPrismaPage, parsePaginationParams } from '@repo/pagination';
import { prisma } from '@repo/prisma';
import { Schema } from 'effect';
import { Hono } from 'hono';

import type { ApiAuthVariables } from '../auth/middleware.js';
import { validate } from '../validation.js';

type AppEnv = { Variables: ApiAuthVariables };

export const membersRouter = new Hono<AppEnv>();

membersRouter.get('/', validate('query', MemberListQuerySchema), async (c) => {
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
    projectId: claims.projectId,
    ...(search
      ? {
          user: {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          },
        }
      : {}),
  };

  const [members, total, owner] = await Promise.all([
    prisma.projectMember.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
      skip,
      take,
    }),
    prisma.projectMember.count({ where }),
    prisma.user.findFirst({
      where: { role: SYSTEM_ROLE.OWNER },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const encoded = Schema.decodeUnknownSync(MemberListPageSchema)({
    owner,
    items: members,
    total,
    page,
    limit,
  });
  return c.json(encoded);
});

membersRouter.get(
  '/addable',
  validate('query', AddableUsersQuerySchema),
  async (c) => {
    const auth = c.get('auth');
    const claims = requireProjectClaims(auth);
    if (!claims) return new Forbidden().toResponse();
    if (!canManageProject(claims)) return new Forbidden().toResponse();

    const { query: queryParam } = c.req.valid('query');
    const query = queryParam?.trim() ?? '';
    if (!query) {
      return c.json(
        Schema.encodeSync(AddableUsersResponseSchema)({ users: [] }),
      );
    }

    const users = await prisma.user.findMany({
      where: {
        role: { not: SYSTEM_ROLE.OWNER },
        projectMembers: { none: { projectId: claims.projectId } },
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, email: true },
      take: 10,
      orderBy: { name: 'asc' },
    });

    const encoded = Schema.decodeUnknownSync(AddableUsersResponseSchema)({
      users,
    });
    return c.json(encoded);
  },
);

membersRouter.post('/', validate('json', AddMemberRequestSchema), async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();
  if (!canManageProject(claims)) return new Forbidden().toResponse();

  const { userId, role } = c.req.valid('json');

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return new UserNotFound().toResponse();
  if (target.role === SYSTEM_ROLE.OWNER) {
    return new CannotAddOwnerAsMember().toResponse();
  }

  const member = await prisma.projectMember.upsert({
    where: { userId_projectId: { userId, projectId: claims.projectId } },
    create: { userId, projectId: claims.projectId, role },
    update: { role },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const encoded = Schema.decodeUnknownSync(MemberListItemSchema)(member);

  return c.json({ member: encoded }, 201);
});

membersRouter.delete(
  '/:memberId',
  validate('param', MemberIdParamSchema),
  async (c) => {
    const auth = c.get('auth');
    const claims = requireProjectClaims(auth);
    if (!claims) return new Forbidden().toResponse();
    if (!canManageProject(claims)) return new Forbidden().toResponse();

    const { memberId } = c.req.valid('param');

    const result = await prisma.projectMember.deleteMany({
      where: { id: memberId, projectId: claims.projectId },
    });
    if (result.count === 0) return new MemberNotFound().toResponse();

    return new Response(null, { status: 204 });
  },
);
