import { AddMemberRequestSchema } from '@repo/api';
import type { AuthJwtClaims, ProjectJwtClaims } from '@repo/auth';
import { isSdkClaims } from '@repo/auth';
import { isMembershipRole, PROJECT_ROLE, SYSTEM_ROLE } from '@repo/auth/roles';
import { buildPrismaPage, parsePaginationParams } from '@repo/pagination';
import { prisma } from '@repo/prisma';
import { Either, Schema } from 'effect';
import { Hono } from 'hono';

import type { ApiAuthVariables } from '../auth/middleware.js';
import {
  CannotAddOwnerAsMember,
  Forbidden,
  InvalidMembershipRole,
  MemberNotFound,
  UserNotFound,
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

export const membersRouter = new Hono<AppEnv>();

membersRouter.get('/', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();

  const { page, limit } = parsePaginationParams(
    Object.fromEntries(new URL(c.req.url).searchParams),
  );
  const { skip, take } = buildPrismaPage(page, limit);

  const search = c.req.query('search')?.trim() ?? '';
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

  return c.json({
    owner,
    members: members.map((m) => ({ id: m.id, role: m.role, user: m.user })),
    total,
    page,
    limit,
  });
});

membersRouter.get('/addable', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();
  if (!canManage(claims)) return new Forbidden().toResponse();

  const query = c.req.query('query')?.trim() ?? '';
  if (!query) return c.json({ users: [] });

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

  return c.json({ users });
});

membersRouter.post('/', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();
  if (!canManage(claims)) return new Forbidden().toResponse();

  const body = await parseBody(c.req.raw);
  const decoded = Schema.decodeUnknownEither(AddMemberRequestSchema)(body);
  if (Either.isLeft(decoded)) {
    if (!isMembershipRole(body['role'])) {
      return new InvalidMembershipRole().toResponse();
    }
    return new UserNotFound().toResponse();
  }
  const { userId, role } = decoded.right;

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

  return c.json(
    { member: { id: member.id, role: member.role, user: member.user } },
    201,
  );
});

membersRouter.delete('/:memberId', async (c) => {
  const auth = c.get('auth');
  const claims = requireProjectClaims(auth);
  if (!claims) return new Forbidden().toResponse();
  if (!canManage(claims)) return new Forbidden().toResponse();

  const { memberId } = c.req.param();

  const result = await prisma.projectMember.deleteMany({
    where: { id: memberId, projectId: claims.projectId },
  });
  if (result.count === 0) return new MemberNotFound().toResponse();

  return new Response(null, { status: 204 });
});
