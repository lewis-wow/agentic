import type { ValueOfEnum } from '@repo/types';

/**
 * System-level role stored on `User.role`. Exactly one `OWNER` exists per
 * installation (created by the setup wizard); everyone else is `MEMBER`.
 */
export const SYSTEM_ROLE = {
  OWNER: 'OWNER',
  MEMBER: 'MEMBER',
} as const;

export type SystemRole = ValueOfEnum<typeof SYSTEM_ROLE>;

/**
 * Project-level role stored on `ProjectMember.role`. The `OWNER` system role
 * bypasses membership entirely, so it is not a membership value.
 */
export const MEMBERSHIP_ROLE = {
  ADMIN: 'admin',
  VIEWER: 'viewer',
} as const;

export type MembershipRole = ValueOfEnum<typeof MEMBERSHIP_ROLE>;

/**
 * `projectRole` claim carried by the project-scoped JWT minted by the BFF.
 * Owners resolve to `owner`; members carry their `MembershipRole`; SDK clients
 * (environment API keys) carry `sdk-client`.
 */
export const PROJECT_ROLE = {
  OWNER: 'owner',
  ADMIN: 'admin',
  VIEWER: 'viewer',
  SDK_CLIENT: 'sdk-client',
} as const;

export type ProjectRole = ValueOfEnum<typeof PROJECT_ROLE>;

export const isMembershipRole = (value: unknown): value is MembershipRole =>
  value === MEMBERSHIP_ROLE.ADMIN || value === MEMBERSHIP_ROLE.VIEWER;
