import { PROJECT_ROLE, SYSTEM_ROLE } from '@repo/auth/roles';
import { describe, expect, it } from 'vitest';

import { resolveProjectRole } from '../../src/projectRole.js';

describe('resolveProjectRole', () => {
  it('returns OWNER for a system OWNER', () => {
    const role = resolveProjectRole({ user: { role: SYSTEM_ROLE.OWNER } });

    expect(role).toBe(PROJECT_ROLE.OWNER);
  });

  it('returns null for a system MEMBER', () => {
    const role = resolveProjectRole({ user: { role: SYSTEM_ROLE.MEMBER } });

    expect(role).toBeNull();
  });
});
