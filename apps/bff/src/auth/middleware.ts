// Bearer token validation → RS256 JWT minting.
import type { MeJwtClaims, ProjectJwtClaims, SdkJwtClaims } from '@repo/auth';
import { verifyApiKey } from '@repo/auth/api-key';
import { signRs256 } from '@repo/auth/jwt';
import { PROJECT_ROLE, SYSTEM_ROLE, type SystemRole } from '@repo/auth/roles';
import {
  resolveProjectRole,
  resolveTrustedProxyUser,
  type TrustedProxyJwtVerifier,
} from '@repo/bff';
import type { User } from '@repo/prisma';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { LRUCache } from 'lru-cache';

import { JWT_TTL_SECONDS } from '../consts.js';
import {
  Forbidden,
  MissingProjectId,
  Unauthorized,
} from '../exceptions/index.js';

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
  designatedOwnerEmail: string;
  /** Header the reverse proxy sets with the signed Proxy Identity JWT. */
  jwtHeaderName: string;
  /** Verifies the Proxy Identity JWT's signature/algorithm/issuer/audience/expiry. Build once per process — see `createTrustedProxyJwtVerifier`. */
  verify: TrustedProxyJwtVerifier;
  /** Dot-separated path to the identity email claim inside the verified payload (e.g. `claims.email`). */
  emailClaimPath: string;
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

type BuildClaims<TClaims> = (
  c: Context<{ Variables: AuthVariables }>,
  user: User,
) => Promise<TClaims | Response>;

/**
 * Shared frame for both Trusted Proxy Authentication middlewares: verifies
 * the Proxy Identity JWT and upserts the `User` (JIT-provisioning on first
 * sight), then delegates to `buildClaims` for the claims shape specific to
 * this route (project-scoped vs. `/me`). `buildClaims` may itself
 * short-circuit with an error `Response` (e.g. a missing `:projectId` or a
 * failed `resolveProjectRole` check).
 */
const createTrustedProxyMiddleware = <
  TClaims extends ProjectJwtClaims | MeJwtClaims,
>(
  options: TrustedProxyOptions,
  buildClaims: BuildClaims<TClaims>,
) =>
  createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const user = await resolveTrustedProxyUser({
      jwt: c.req.header(options.jwtHeaderName),
      verify: options.verify,
      emailClaimPath: options.emailClaimPath,
      designatedOwnerEmail: options.designatedOwnerEmail,
      upsertUser: options.upsertUser,
    });

    if (!user) {
      return new Unauthorized().toResponse();
    }

    const claimsOrResponse = await buildClaims(c, user);
    if (claimsOrResponse instanceof Response) {
      return claimsOrResponse;
    }
    const claims = claimsOrResponse;

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
 * Project-scoped Trusted Proxy Authentication: resolves the caller's role for
 * `:projectId` and mints an RS256 project JWT.
 *
 * - Owner → `projectRole: 'owner'`. Project access is owner-only.
 * - Missing/invalid Proxy Identity JWT → 401. Non-owner → 403.
 */
export const createTrustedProxyProjectAuthMiddleware = (
  options: TrustedProxyOptions,
) =>
  createTrustedProxyMiddleware<ProjectJwtClaims>(options, (c, user) => {
    const projectId = c.req.param('projectId');
    if (!projectId) {
      return Promise.resolve(new MissingProjectId().toResponse());
    }

    const projectRole = resolveProjectRole({
      user: { role: user.role as SystemRole },
    });

    if (!projectRole) {
      return Promise.resolve(new Forbidden().toResponse());
    }

    return Promise.resolve({
      userId: user.id,
      systemRole:
        user.role === SYSTEM_ROLE.OWNER
          ? SYSTEM_ROLE.OWNER
          : SYSTEM_ROLE.MEMBER,
      projectId,
      projectRole,
    });
  });

/**
 * Non-project-scoped Trusted Proxy Authentication (e.g. `/me`): mints a JWT
 * carrying only `{ userId, systemRole }`.
 */
export const createTrustedProxyMeAuthMiddleware = (
  options: TrustedProxyOptions,
) =>
  createTrustedProxyMiddleware<MeJwtClaims>(options, (_c, user) =>
    Promise.resolve({
      userId: user.id,
      systemRole:
        user.role === SYSTEM_ROLE.OWNER
          ? SYSTEM_ROLE.OWNER
          : SYSTEM_ROLE.MEMBER,
    }),
  );

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
