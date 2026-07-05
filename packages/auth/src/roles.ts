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
 * `projectRole` claim carried by the project-scoped JWT minted by the BFF.
 * Only the `OWNER` system role may access a project; SDK clients
 * (environment API keys) carry `sdk-client`.
 */
export const PROJECT_ROLE = {
  OWNER: 'owner',
  SDK_CLIENT: 'sdk-client',
} as const;

export type ProjectRole = ValueOfEnum<typeof PROJECT_ROLE>;
