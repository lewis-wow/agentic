import { ProjectService } from '@repo/api/services';
import type { SystemRole } from '@repo/auth/roles';
import {
  createTrustedProxyJwtVerifier,
  type DashboardProjectRole,
  resolveProjectRole,
  resolveTrustedProxyUser,
  UserService,
} from '@repo/bff';
import { prisma } from '@repo/prisma';
import { headers } from 'next/headers';
import { forbidden, unauthorized } from 'next/navigation';
import { cache } from 'react';

import { env } from '../env';

export type AuthedUser = {
  id: string;
  email: string;
  name: string;
  role: SystemRole;
};

const userService = new UserService({ prisma });
const projectService = new ProjectService({ prisma });

// Built once per process — owns an in-memory JWKS key cache, never rebuild per request.
const trustedProxyVerify = createTrustedProxyJwtVerifier({
  jwksUrl: env.TRUSTED_PROXY_JWKS_URL,
  issuer: env.TRUSTED_PROXY_JWT_ISSUER,
  audience: env.TRUSTED_PROXY_JWT_AUDIENCE,
  algorithms: env.TRUSTED_PROXY_JWT_ALGORITHM,
});

/**
 * Role-agnostic "has any project been created yet" check, used to redirect
 * to `/setup` on a fresh install. Wrapped in `cache()` for the same reason as
 * `resolveAuthedUser` — a layout and its page can independently need this
 * within one request, and it should only run one query.
 */
export const projectsExist = cache(
  (): Promise<boolean> => projectService.exists(),
);

/**
 * Resolves the current request's identity via Trusted Proxy Authentication —
 * verifies the Proxy Identity JWT set by the operator's reverse proxy
 * (Pomerium, or any other proxy that can present one). Returns `null` when
 * the header is missing or verification fails; does not redirect or throw,
 * so callers can decide what to render (e.g. `/setup` shows a different state
 * than a normal guarded page).
 *
 * Wrapped in `cache()` because both a layout and its page can independently
 * call `requireSession()` for the same request. Without dedup, two concurrent
 * calls for a brand-new email both race to `upsertUser`, and the loser gets a
 * unique-constraint error instead of the winner's row (upsert is not immune
 * to this under concurrent execution). Caching collapses them into one call.
 */
export const resolveAuthedUser = cache(async (): Promise<AuthedUser | null> => {
  const requestHeaders = await headers();

  const user = await resolveTrustedProxyUser({
    jwt: requestHeaders.get(env.TRUSTED_PROXY_JWT_HEADER) ?? undefined,
    verify: trustedProxyVerify,
    emailClaimPath: env.TRUSTED_PROXY_JWT_EMAIL_CLAIM,
    designatedOwnerEmail: env.TRUSTED_PROXY_OWNER_EMAIL,
    upsertUser: (args) => userService.upsert(args),
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as SystemRole,
  };
});

/** Validate the trusted-proxy identity; renders the `unauthorized()` boundary when absent/invalid. */
export const requireSession = async (): Promise<AuthedUser> => {
  const user = await resolveAuthedUser();

  if (!user) {
    unauthorized();
  }

  return user;
};

export type ProjectAccess = {
  user: AuthedUser;
  projectRole: DashboardProjectRole;
};

/** Resolve the current user's access to a project. Project access is owner-only — a non-owner gets 403. */
export const requireProjectAccess = async (): Promise<ProjectAccess> => {
  const user = await requireSession();

  const projectRole = resolveProjectRole({ user: { role: user.role } });

  if (!projectRole) {
    forbidden();
  }

  return { user, projectRole };
};
