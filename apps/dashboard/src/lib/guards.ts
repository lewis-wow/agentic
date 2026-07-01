import {
  isMembershipRole,
  PROJECT_ROLE,
  type ProjectRole,
  SYSTEM_ROLE,
  type SystemRole,
} from '@repo/auth/roles';
import { prisma } from '@repo/prisma';
import { forbidden, redirect } from 'next/navigation';

import { type Session } from './auth';
import { getSession } from './session';

export type AuthedUser = {
  id: string;
  email: string;
  name: string;
  role: SystemRole;
};

const toAuthedUser = (session: Session): AuthedUser => ({
  id: session.user.id,
  email: session.user.email,
  name: session.user.name,
  role: (session.user.role as SystemRole | undefined) ?? SYSTEM_ROLE.MEMBER,
});

/** Validate the session against the DB; redirect to /login when absent/expired. */
export const requireSession = async (): Promise<AuthedUser> => {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return toAuthedUser(session);
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
