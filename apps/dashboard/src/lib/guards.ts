import {
  isMembershipRole,
  PROJECT_ROLE,
  type ProjectRole,
  SYSTEM_ROLE,
  type SystemRole,
} from '@repo/auth/roles';
import { resolveTrustedProxyUser } from '@repo/bff';
import { prisma } from '@repo/prisma';
import { headers } from 'next/headers';
import { forbidden, unauthorized } from 'next/navigation';
import { cache } from 'react';

import { TRUSTED_PROXY_SECRET_HEADER } from '../consts';
import { env } from '../env';

export type AuthedUser = {
  id: string;
  email: string;
  name: string;
  role: SystemRole;
};

const upsertUser = ({ email, role }: { email: string; role: SystemRole }) =>
  prisma.user.upsert({
    where: { email },
    create: { email, name: email, role },
    update: {},
  });

/**
 * Resolves the current request's identity via Trusted Proxy Authentication —
 * the Trusted Proxy Secret + Identity Header set by the operator's reverse
 * proxy (oauth2-proxy, Authelia, Pomerium, ...). Returns `null` when either
 * header is missing or the secret doesn't match; does not redirect or throw,
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
    secret: requestHeaders.get(TRUSTED_PROXY_SECRET_HEADER) ?? undefined,
    email: requestHeaders.get(env.TRUSTED_PROXY_IDENTITY_HEADER) ?? undefined,
    expectedSecret: env.TRUSTED_PROXY_SECRET,
    designatedOwnerEmail: env.TRUSTED_PROXY_OWNER_EMAIL,
    upsertUser,
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

/** Gate an owner-only route. Non-owners receive a 403. */
export const requireOwner = async (): Promise<AuthedUser> => {
  const user = await requireSession();

  if (user.role !== SYSTEM_ROLE.OWNER) {
    forbidden();
  }

  return user;
};

export type ProjectAccess = {
  user: AuthedUser;
  projectRole: ProjectRole;
};

/**
 * Resolve the current user's access to a project.
 * - OWNER bypasses membership and gets `owner`.
 * - Otherwise the `ProjectMember` row determines `admin` | `viewer`.
 * - No membership → 403.
 */
export const requireProjectAccess = async (
  projectId: string,
): Promise<ProjectAccess> => {
  const user = await requireSession();

  if (user.role === SYSTEM_ROLE.OWNER) {
    return { user, projectRole: PROJECT_ROLE.OWNER };
  }

  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: user.id, projectId } },
  });

  if (!membership || !isMembershipRole(membership.role)) {
    forbidden();
  }

  return { user, projectRole: membership.role };
};
