import type { MeJwtClaims, ProjectJwtClaims, SdkJwtClaims } from '@repo/auth';
import { verifyApiKey } from '@repo/auth/api-key';
import { signRs256 } from '@repo/auth/jwt';
import {
  isMembershipRole,
  PROJECT_ROLE,
  SYSTEM_ROLE,
  type SystemRole,
} from '@repo/auth/roles';
import { resolveTrustedProxyUser } from '@repo/bff';
import type { ProjectMember, User } from '@repo/prisma';
import { createMiddleware } from 'hono/factory';
import { LRUCache } from 'lru-cache';

import { JWT_TTL_SECONDS, TRUSTED_PROXY_SECRET_HEADER } from '../consts.js';

type MembershipLookup = (
  userId: string,
  projectId: string,
) => Promise<ProjectMember | null>;
type UpsertUser = (args: { email: string; role: SystemRole }) => Promise<User>;

export type ApiKeyLookupResult = {
  apiKeyHash: string;
  revokedAt: Date | null;
  environmentId: string;
  environment: { projectId: string };
};
type ApiKeyLookup = (apiKeyId: string) => Promise<ApiKeyLookupResult | null>;

/** Options shared by both Trusted Proxy Authentication middlewares. */
type TrustedProxyOptions = {
  upsertUser: UpsertUser;
  privateKeyPem: string;
  expectedSecret: string;
  designatedOwnerEmail: string;
  identityHeaderName: string;
};

type TrustedProxyProjectOptions = TrustedProxyOptions & {
  findMembership: MembershipLookup;
};

type SdkMiddlewareOptions = {
  findApiKey: ApiKeyLookup;
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
 * Project-scoped Trusted Proxy Authentication: validates the Trusted Proxy
 * Secret + Identity Header, upserts the `User` (JIT-provisioning on first
 * sight), resolves the caller's role for `:projectId`, and mints an RS256
 * project JWT.
 *
 * - Owner bypasses membership → `projectRole: 'owner'`.
 * - Member must have a `ProjectMember` row → `projectRole: 'admin' | 'viewer'`.
 * - Missing/invalid secret or identity header → 401. No membership → 403.
 */
export const createTrustedProxyProjectAuthMiddleware = (
  options: TrustedProxyProjectOptions,
) =>
  createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const user = await resolveTrustedProxyUser({
      secret: c.req.header(TRUSTED_PROXY_SECRET_HEADER),
      email: c.req.header(options.identityHeaderName),
      expectedSecret: options.expectedSecret,
      designatedOwnerEmail: options.designatedOwnerEmail,
      upsertUser: options.upsertUser,
    });

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
 * Non-project-scoped Trusted Proxy Authentication (e.g. `/me`): validates the
 * Trusted Proxy Secret + Identity Header and mints a JWT carrying only
 * `{ userId, systemRole }`.
 */
export const createTrustedProxyMeAuthMiddleware = (
  options: TrustedProxyOptions,
) =>
  createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const user = await resolveTrustedProxyUser({
      secret: c.req.header(TRUSTED_PROXY_SECRET_HEADER),
      email: c.req.header(options.identityHeaderName),
      expectedSecret: options.expectedSecret,
      designatedOwnerEmail: options.designatedOwnerEmail,
      upsertUser: options.upsertUser,
    });

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
 * Parses `apiKeyId` from a full SDK key of the form
 * `<cosmeticPrefix>_<apiKeyId>.<secret>`, where `<cosmeticPrefix>_` may be
 * absent entirely. The prefix is a display-only hint (see
 * docs/adr/0008-api-key-prefix-is-cosmetic-only.md) and is never validated —
 * only the trailing `<32-hex apiKeyId>.<64-hex secret>` shape matters.
 * Returns `undefined` for any other format.
 */
const API_KEY_SHAPE = /([0-9a-f]{32})\.[0-9a-f]{64}$/;

const parseApiKeyId = (fullKey: string): string | undefined =>
  API_KEY_SHAPE.exec(fullKey)?.[1];

/**
 * SDK auth: exchanges an `env_<apiKeyId>.<secret>` Bearer token for an
 * SDK-scoped JWT. Verifies the secret against the stored bcrypt hash.
 * Caches verified `apiKeyId → environmentId` for 60 s to skip bcrypt on
 * subsequent requests.
 *
 * `findApiKey` is called on every request regardless of cache state (it's
 * a cheap indexed lookup), which also means a revoked key is rejected
 * immediately — there's no window where a cached key keeps working after
 * being revoked, since revocation is only ever checked against live data.
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

    const apiKey = await options.findApiKey(apiKeyId);
    if (!apiKey || apiKey.revokedAt !== null) {
      cache.delete(apiKeyId);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const isCached = cache.get(apiKeyId) === apiKey.environmentId;

    if (!isCached) {
      const valid = await verifyApiKey({
        fullKey,
        apiKeyHash: apiKey.apiKeyHash,
      });
      if (!valid) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      cache.set(apiKeyId, apiKey.environmentId);
    }

    const claims: SdkJwtClaims = {
      projectId: apiKey.environment.projectId,
      environmentId: apiKey.environmentId,
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
