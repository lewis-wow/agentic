import { isMembershipRole, PROJECT_ROLE, SYSTEM_ROLE } from '@repo/auth/roles';
import type { ProjectRole, SystemRole } from '@repo/auth/roles';
import type { ProjectMember } from '@repo/prisma';

type MembershipLookup = (
  userId: string,
  projectId: string,
) => Promise<ProjectMember | null>;

export type ResolveProjectRoleArgs = {
  user: { id: string; role: SystemRole };
  projectId: string;
  findMembership: MembershipLookup;
};

/** `resolveProjectRole` never returns the SDK-client project role — that role is only ever minted from an environment API key, never from a dashboard user's session. */
export type DashboardProjectRole = Exclude<
  ProjectRole,
  typeof PROJECT_ROLE.SDK_CLIENT
>;

/**
 * Resolves a user's `ProjectRole` for a project. `OWNER` bypasses membership
 * entirely; otherwise the caller's injected `findMembership` is consulted.
 * Returns `null` when no valid membership exists — callers translate that
 * into their own error convention (HTTP 403, Next.js `forbidden()`, ...).
 */
export const resolveProjectRole = async (
  args: ResolveProjectRoleArgs,
): Promise<DashboardProjectRole | null> => {
  if (args.user.role === SYSTEM_ROLE.OWNER) {
    return PROJECT_ROLE.OWNER;
  }

  const membership = await args.findMembership(args.user.id, args.projectId);
  if (!membership || !isMembershipRole(membership.role)) {
    return null;
  }

  return membership.role;
};
