import type { MeJwtClaims, ProjectJwtClaims, SdkJwtClaims } from '@repo/auth';
import { signRs256 } from '@repo/auth/jwt';
import { isMembershipRole, PROJECT_ROLE, SYSTEM_ROLE } from '@repo/auth/roles';
import type { Environment, ProjectMember, Session, User } from '@repo/prisma';
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';

/** The minted JWT covers a single proxied request, so its lifetime is short. */
export const JWT_TTL_SECONDS = 60;

/** Cookie name better-auth uses for the session token. */
export const SESSION_COOKIE = 'better-auth.session_token';

export type SessionWithUser = Session & { user: User };

type SessionLookup = (token: string) => Promise<SessionWithUser | null>;
type MembershipLookup = (
  userId: string,
  projectId: string,
) => Promise<ProjectMember | null>;
type EnvironmentLookup = (apiKey: string) => Promise<Environment | null>;

type SessionMiddlewareOptions = {
  findSession: SessionLookup;
  privateKeyPem: string;
  cookieName?: string;
};

type ProjectMiddlewareOptions = SessionMiddlewareOptions & {
  findMembership: MembershipLookup;
};

type SdkMiddlewareOptions = {
  findEnvironment: EnvironmentLookup;
  privateKeyPem: string;
};

/** Variables every auth middleware sets so a downstream proxy can forward. */
export type AuthVariables = {
  jwt: string;
  claims: ProjectJwtClaims | MeJwtClaims | SdkJwtClaims;
};

/**
 * better-auth stores the cookie as `<token>.<signature>`. The DB row keys on the
 * raw token, so strip the signature before lookup.
 */
const extractToken = (rawCookie: string): string => {
  const decoded = decodeURIComponent(rawCookie);
  const dot = decoded.indexOf('.');
  return dot === -1 ? decoded : decoded.slice(0, dot);
};

const resolveSessionUser = async (
  findSession: SessionLookup,
  rawCookie: string | undefined,
): Promise<User | null> => {
  if (!rawCookie) {
    return null;
  }

  const token = extractToken(rawCookie);
  if (!token) {
    return null;
  }

  const session = await findSession(token);
  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return session.user;
};

/**
 * Project-scoped auth: validates the session cookie, resolves the caller's role
 * for `:projectId`, and mints an RS256 project JWT.
 *
 * - Owner bypasses membership → `projectRole: 'owner'`.
 * - Member must have a `ProjectMember` row → `projectRole: 'admin' | 'viewer'`.
 * - Missing/expired session → 401. No membership → 403.
 */
export const createProjectAuthMiddleware = (
  options: ProjectMiddlewareOptions,
) =>
  createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const user = await resolveSessionUser(
      options.findSession,
      getCookie(c, options.cookieName ?? SESSION_COOKIE),
    );

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('projectId');
    if (!projectId) {
      return c.json({ error: 'Missing project id' }, 400);
    }

    let claims: ProjectJwtClaims;

    if (user.role === SYSTEM_ROLE.OWNER) {
      claims = {
        userId: user.id,
        systemRole: SYSTEM_ROLE.OWNER,
        projectId,
        projectRole: PROJECT_ROLE.OWNER,
      };
    } else {
      const membership = await options.findMembership(user.id, projectId);
      if (!membership || !isMembershipRole(membership.role)) {
        return c.json({ error: 'Forbidden' }, 403);
      }

      claims = {
        userId: user.id,
        systemRole: SYSTEM_ROLE.MEMBER,
        projectId,
        projectRole: membership.role,
      };
    }

    const jwt = signRs256({
      payload: claims,
      privateKeyPem: options.privateKeyPem,
      expiresInSeconds: JWT_TTL_SECONDS,
    });

    c.set('claims', claims);
    c.set('jwt', jwt);
    c.header('Authorization', `Bearer ${jwt}`);

    await next();
  });

/**
 * Non-project-scoped auth (e.g. `/me`): validates the session and mints a JWT
 * carrying only `{ userId, systemRole }`.
 */
export const createMeAuthMiddleware = (options: SessionMiddlewareOptions) =>
  createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const user = await resolveSessionUser(
      options.findSession,
      getCookie(c, options.cookieName ?? SESSION_COOKIE),
    );

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const claims: MeJwtClaims = {
      userId: user.id,
      systemRole:
        user.role === SYSTEM_ROLE.OWNER
          ? SYSTEM_ROLE.OWNER
          : SYSTEM_ROLE.MEMBER,
    };

    const jwt = signRs256({
      payload: claims,
      privateKeyPem: options.privateKeyPem,
      expiresInSeconds: JWT_TTL_SECONDS,
    });

    c.set('claims', claims);
    c.set('jwt', jwt);
    c.header('Authorization', `Bearer ${jwt}`);

    await next();
  });

/**
 * SDK auth: exchanges an `Environment.apiKey` (Authorization: Bearer <apiKey>)
 * for an SDK-scoped JWT. Unknown key → 401.
 */
export const createSdkAuthMiddleware = (options: SdkMiddlewareOptions) =>
  createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const header = c.req.header('Authorization');
    const apiKey = header?.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : undefined;

    if (!apiKey) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const environment = await options.findEnvironment(apiKey);
    if (!environment) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const claims: SdkJwtClaims = {
      projectId: environment.projectId,
      environmentId: environment.id,
      projectRole: PROJECT_ROLE.SDK_CLIENT,
    };

    const jwt = signRs256({
      payload: claims,
      privateKeyPem: options.privateKeyPem,
      expiresInSeconds: JWT_TTL_SECONDS,
    });

    c.set('claims', claims);
    c.set('jwt', jwt);
    c.header('Authorization', `Bearer ${jwt}`);

    await next();
  });
