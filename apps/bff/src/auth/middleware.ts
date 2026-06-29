import type { MeJwtClaims, ProjectJwtClaims, SdkJwtClaims } from '@repo/auth';
import { verifyApiKey } from '@repo/auth/api-key';
import { signRs256 } from '@repo/auth/jwt';
import { isMembershipRole, PROJECT_ROLE, SYSTEM_ROLE } from '@repo/auth/roles';
import { resolveSessionUser, SESSION_COOKIE } from '@repo/bff';
import type { Environment, ProjectMember } from '@repo/prisma';
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { LRUCache } from 'lru-cache';

import { JWT_TTL_SECONDS } from '../consts.js';

export { SESSION_COOKIE, type SessionWithUser } from '@repo/bff';

type SessionLookup = Parameters<typeof resolveSessionUser>[1];
type MembershipLookup = (
  userId: string,
  projectId: string,
) => Promise<ProjectMember | null>;
type EnvironmentLookup = (apiKeyId: string) => Promise<Environment | null>;

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
  /** Injected in tests to replace the module-level cache. */
  cache?: LRUCache<string, string>;
};

/** Variables every auth middleware sets so a downstream proxy can forward. */
export type AuthVariables = {
  jwt: string;
  claims: ProjectJwtClaims | MeJwtClaims | SdkJwtClaims;
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
      getCookie(c, options.cookieName ?? SESSION_COOKIE),
      options.findSession,
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
      getCookie(c, options.cookieName ?? SESSION_COOKIE),
      options.findSession,
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

/** Module-level LRU cache: apiKeyId → environmentId (60 s TTL, max 500 entries). */
const defaultSdkCache = new LRUCache<string, string>({
  max: 500,
  ttl: 60_000,
});

/**
 * Parses `apiKeyId` from a full SDK key of the form `env_<apiKeyId>.<secret>`.
 * Returns `undefined` for any other format.
 */
const parseApiKeyId = (fullKey: string): string | undefined => {
  if (!fullKey.startsWith('env_')) {
    return undefined;
  }
  const withoutPrefix = fullKey.slice('env_'.length);
  const dotIndex = withoutPrefix.indexOf('.');
  if (dotIndex === -1) {
    return undefined;
  }
  return withoutPrefix.slice(0, dotIndex);
};

/**
 * SDK auth: exchanges an `env_<apiKeyId>.<secret>` Bearer token for an
 * SDK-scoped JWT. Verifies the secret against the stored bcrypt hash.
 * Caches verified `apiKeyId → environmentId` for 60 s to skip bcrypt on
 * subsequent requests.
 */
export const createSdkAuthMiddleware = (options: SdkMiddlewareOptions) => {
  const cache = options.cache ?? defaultSdkCache;

  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const header = c.req.header('Authorization');
    const fullKey = header?.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : undefined;

    if (!fullKey) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const apiKeyId = parseApiKeyId(fullKey);
    if (!apiKeyId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const cachedEnvironmentId = cache.get(apiKeyId);

    let environmentId: string;
    let projectId: string;

    if (cachedEnvironmentId) {
      // Cache hit — skip DB lookup and bcrypt.
      const environment = await options.findEnvironment(apiKeyId);
      if (!environment) {
        cache.delete(apiKeyId);
        return c.json({ error: 'Unauthorized' }, 401);
      }
      environmentId = cachedEnvironmentId;
      projectId = environment.projectId;
    } else {
      const environment = await options.findEnvironment(apiKeyId);
      if (!environment) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const valid = await verifyApiKey({
        fullKey,
        apiKeyHash: environment.apiKeyHash,
      });
      if (!valid) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      cache.set(apiKeyId, environment.id);
      environmentId = environment.id;
      projectId = environment.projectId;
    }

    const claims: SdkJwtClaims = {
      projectId,
      environmentId,
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
};
