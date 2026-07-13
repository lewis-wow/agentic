import { SYSTEM_ROLE } from '@repo/auth/roles';
import { prisma } from '@repo/prisma';
import { afterEach, describe, expect, it } from 'vitest';

import { UserService } from '../../../src/services/UserService.js';

let email: string | undefined;

afterEach(async () => {
  if (email) {
    await prisma.user.delete({ where: { email } }).catch(() => undefined);
    email = undefined;
  }
});

describe('UserService.upsert', () => {
  it('creates a new user with the given email and role', async () => {
    email = `user-${Date.now()}@example.com`;
    const service = new UserService({ prisma });

    const user = await service.upsert({ email, role: SYSTEM_ROLE.MEMBER });

    expect(user.email).toBe(email);
    expect(user.role).toBe(SYSTEM_ROLE.MEMBER);
    expect(user.name).toBe(email);
  });

  it('does not overwrite an existing user role on a subsequent upsert', async () => {
    email = `owner-${Date.now()}@example.com`;
    const service = new UserService({ prisma });

    const created = await service.upsert({
      email,
      role: SYSTEM_ROLE.OWNER,
    });
    const upserted = await service.upsert({
      email,
      role: SYSTEM_ROLE.MEMBER,
    });

    expect(upserted.id).toBe(created.id);
    expect(upserted.role).toBe(SYSTEM_ROLE.OWNER);
  });
});
