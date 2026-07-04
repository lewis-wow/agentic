import { describe, expect, it } from 'vitest';

import { canManageProject, requireProjectClaims } from '../../src/claims.js';
import { PROJECT_ROLE, SYSTEM_ROLE } from '../../src/roles.js';

describe('requireProjectClaims', () => {
  it('narrows project-scoped claims', () => {
    const claims = {
      userId: 'u1',
      systemRole: SYSTEM_ROLE.MEMBER,
      projectId: 'p1',
      projectRole: PROJECT_ROLE.ADMIN,
    };

    expect(requireProjectClaims(claims)).toEqual(claims);
  });

  it('returns null for non-project-scoped (me) claims', () => {
    const claims = { userId: 'u1', systemRole: SYSTEM_ROLE.MEMBER };

    expect(requireProjectClaims(claims)).toBeNull();
  });

  it('returns null for SDK claims', () => {
    const claims = {
      projectId: 'p1',
      environmentId: 'e1',
      projectRole: PROJECT_ROLE.SDK_CLIENT,
    };

    expect(requireProjectClaims(claims)).toBeNull();
  });
});

describe('canManageProject', () => {
  it('allows OWNER', () => {
    expect(
      canManageProject({
        userId: 'u1',
        systemRole: SYSTEM_ROLE.OWNER,
        projectId: 'p1',
        projectRole: PROJECT_ROLE.OWNER,
      }),
    ).toBe(true);
  });

  it('allows ADMIN', () => {
    expect(
      canManageProject({
        userId: 'u1',
        systemRole: SYSTEM_ROLE.MEMBER,
        projectId: 'p1',
        projectRole: PROJECT_ROLE.ADMIN,
      }),
    ).toBe(true);
  });

  it('denies VIEWER', () => {
    expect(
      canManageProject({
        userId: 'u1',
        systemRole: SYSTEM_ROLE.MEMBER,
        projectId: 'p1',
        projectRole: PROJECT_ROLE.VIEWER,
      }),
    ).toBe(false);
  });
});
