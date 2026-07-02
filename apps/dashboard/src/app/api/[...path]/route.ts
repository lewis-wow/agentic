import type { AuthJwtClaims } from '@repo/auth';
import { decodeBase64Pem, signRs256 } from '@repo/auth/jwt';
import { isMembershipRole, PROJECT_ROLE, SYSTEM_ROLE } from '@repo/auth/roles';
import { forwardWithJwt, resolveSessionUser, SESSION_COOKIE } from '@repo/bff';
import { prisma } from '@repo/prisma';
import { cookies } from 'next/headers';

import { JWT_TTL_SECONDS } from '../../../consts';
import { env } from '../../../env';

/**
 * Session-cookie -> RS256 JWT exchange (the dashboard's BFF layer). Every
 * request that reaches apps/api goes through here: the session cookie proves
 * who the user is, and the freshly minted JWT tells apps/api what they're
 * allowed to do. apps/api never sees the session or touches this database.
 */
const handler = async (
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> => {
  const { path } = await params;

  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(SESSION_COOKIE)?.value;

  const user = await resolveSessionUser(rawCookie, (token) =>
    prisma.session.findUnique({ where: { token }, include: { user: true } }),
  );

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId =
    path[0] === 'projects' && path.length > 1 ? path[1] : undefined;

  let claims: AuthJwtClaims;

  if (!projectId) {
    // Non-project-scoped request (e.g. /projects list+create, /users, /me).
    // apps/api decides per-route whether the systemRole is sufficient.
    claims = {
      userId: user.id,
      systemRole:
        user.role === SYSTEM_ROLE.OWNER
          ? SYSTEM_ROLE.OWNER
          : SYSTEM_ROLE.MEMBER,
    };
  } else if (user.role === SYSTEM_ROLE.OWNER) {
    claims = {
      userId: user.id,
      systemRole: SYSTEM_ROLE.OWNER,
      projectId,
      projectRole: PROJECT_ROLE.OWNER,
    };
  } else {
    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: user.id, projectId } },
    });

    if (!membership || !isMembershipRole(membership.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    claims = {
      userId: user.id,
      systemRole: SYSTEM_ROLE.MEMBER,
      projectId,
      projectRole: membership.role,
    };
  }

  const privateKeyPem = decodeBase64Pem(env.AUTH_PRIVATE_KEY);
  const jwt = signRs256({
    payload: claims,
    privateKeyPem,
    expiresInSeconds: JWT_TTL_SECONDS,
  });

  const apiPath = '/' + path.join('/');
  const query = new URL(request.url).search;
  const method = request.method;
  const body =
    method === 'GET' || method === 'HEAD'
      ? undefined
      : await request.arrayBuffer();

  const proxyRequest = new Request(
    new URL(apiPath + query, 'http://placeholder').toString(),
    { method, headers: request.headers, body },
  );

  return forwardWithJwt(proxyRequest, jwt, env.API_URL);
};

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
