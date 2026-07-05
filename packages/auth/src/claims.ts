import { PROJECT_ROLE, type ProjectRole, type SystemRole } from './roles.js';

/**
 * The JWT contract between the BFF (signer) and `apps/api` (verifier).
 * `apps/api` trusts these claims entirely — it has no auth DB dependency.
 */

/** Project-scoped token for a dashboard user (owner-only). */
export type ProjectJwtClaims = {
  userId: string;
  systemRole: SystemRole;
  projectId: string;
  projectRole: Exclude<ProjectRole, typeof PROJECT_ROLE.SDK_CLIENT>;
};

/** Project-scoped token for an SDK client authenticated via environment API key. */
export type SdkJwtClaims = {
  projectId: string;
  environmentId: string;
  projectRole: typeof PROJECT_ROLE.SDK_CLIENT;
};

/** Non-project-scoped token for endpoints like `/me`. */
export type MeJwtClaims = {
  userId: string;
  systemRole: SystemRole;
};

export type AuthJwtClaims = ProjectJwtClaims | SdkJwtClaims | MeJwtClaims;

export const isSdkClaims = (claims: AuthJwtClaims): claims is SdkJwtClaims =>
  'projectRole' in claims && claims.projectRole === PROJECT_ROLE.SDK_CLIENT;

/** Narrows to project-scoped claims, or `null` for `MeJwtClaims`/`SdkJwtClaims`. */
export const requireProjectClaims = (
  claims: AuthJwtClaims,
): ProjectJwtClaims | null => {
  if (!('userId' in claims) || !('projectId' in claims)) return null;
  if (isSdkClaims(claims)) return null;
  return claims as ProjectJwtClaims;
};

/** The `OWNER` project role may create/update/delete a project's resources — the only non-SDK role that exists. */
export const canManageProject = (claims: ProjectJwtClaims): boolean =>
  claims.projectRole === PROJECT_ROLE.OWNER;
