import { PROJECT_ROLE, SYSTEM_ROLE } from '@repo/auth/roles';
import type { ProjectMember } from '@repo/prisma';
import { describe, expect, it, vi } from 'vitest';

import { resolveProjectRole } from '../../src/projectRole.js';

const makeMembership = (
  overrides: Partial<ProjectMember> = {},
): ProjectMember => ({
  id: 'member-1',
  userId: 'user-1',
  projectId: 'project-1',
  role: 'admin',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('resolveProjectRole', () => {
  it('returns OWNER for a system OWNER, bypassing membership entirely', async () => {
    const findMembership = vi.fn();

    const role = await resolveProjectRole({
      user: { id: 'user-1', role: SYSTEM_ROLE.OWNER },
      projectId: 'project-1',
      findMembership,
    });

    expect(role).toBe(PROJECT_ROLE.OWNER);
    expect(findMembership).not.toHaveBeenCalled();
  });

  it("returns the member's ProjectMember.role when a membership exists", async () => {
    const findMembership = vi
      .fn()
      .mockResolvedValue(makeMembership({ role: 'viewer' }));

    const role = await resolveProjectRole({
      user: { id: 'user-1', role: SYSTEM_ROLE.MEMBER },
      projectId: 'project-1',
      findMembership,
    });

    expect(role).toBe('viewer');
    expect(findMembership).toHaveBeenCalledWith('user-1', 'project-1');
  });

  it('returns null when no membership exists', async () => {
    const findMembership = vi.fn().mockResolvedValue(null);

    const role = await resolveProjectRole({
      user: { id: 'user-1', role: SYSTEM_ROLE.MEMBER },
      projectId: 'project-1',
      findMembership,
    });

    expect(role).toBeNull();
  });

  it('returns null when the membership role is not a valid MembershipRole', async () => {
    const findMembership = vi
      .fn()
      .mockResolvedValue(makeMembership({ role: 'owner' }));

    const role = await resolveProjectRole({
      user: { id: 'user-1', role: SYSTEM_ROLE.MEMBER },
      projectId: 'project-1',
      findMembership,
    });

    expect(role).toBeNull();
  });
});
