import { PROJECT_ROLE, SYSTEM_ROLE } from '@repo/auth/roles';
import type { ProjectRole, SystemRole } from '@repo/auth/roles';

export type ResolveProjectRoleArgs = {
  user: { role: SystemRole };
};

/** `resolveProjectRole` never returns the SDK-client project role — that role is only ever minted from an environment API key, never from a dashboard user's session. */
export type DashboardProjectRole = Exclude<
  ProjectRole,
  typeof PROJECT_ROLE.SDK_CLIENT
>;

/**
 * Resolves a user's `ProjectRole` for a project. Only the system `OWNER`
 * may access any project; everyone else is denied. Callers translate a
 * `null` result into their own error convention (HTTP 403, Next.js
 * `forbidden()`, ...).
 */
export const resolveProjectRole = (
  args: ResolveProjectRoleArgs,
): DashboardProjectRole | null =>
  args.user.role === SYSTEM_ROLE.OWNER ? PROJECT_ROLE.OWNER : null;
