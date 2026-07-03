import { SYSTEM_ROLE } from '@repo/auth/roles';
import type { User } from '@repo/prisma';
import { describe, expect, it, vi } from 'vitest';

import { resolveTrustedProxyUser } from '../../src/trustedProxy.js';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  name: 'Test User',
  email: 'user@example.com',
  emailVerified: true,
  image: null,
  role: SYSTEM_ROLE.MEMBER,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('resolveTrustedProxyUser', () => {
  it('returns null when the secret does not match the expected secret', async () => {
    const upsertUser = vi.fn();

    const result = await resolveTrustedProxyUser({
      secret: 'wrong-secret',
      email: 'user@example.com',
      expectedSecret: 'correct-secret',
      designatedOwnerEmail: 'owner@example.com',
      upsertUser,
    });

    expect(result).toBeNull();
  });

  it('does not call upsertUser when the secret does not match', async () => {
    const upsertUser = vi.fn();

    await resolveTrustedProxyUser({
      secret: 'wrong-secret',
      email: 'user@example.com',
      expectedSecret: 'correct-secret',
      designatedOwnerEmail: 'owner@example.com',
      upsertUser,
    });

    expect(upsertUser).not.toHaveBeenCalled();
  });

  it('returns null when email is missing, even with a valid secret', async () => {
    const upsertUser = vi.fn();

    const result = await resolveTrustedProxyUser({
      secret: 'correct-secret',
      email: undefined,
      expectedSecret: 'correct-secret',
      designatedOwnerEmail: 'owner@example.com',
      upsertUser,
    });

    expect(result).toBeNull();
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it('upserts and returns the user as MEMBER for a non-owner email', async () => {
    const user = makeUser({
      email: 'user@example.com',
      role: SYSTEM_ROLE.MEMBER,
    });
    const upsertUser = vi.fn().mockResolvedValue(user);

    const result = await resolveTrustedProxyUser({
      secret: 'correct-secret',
      email: 'user@example.com',
      expectedSecret: 'correct-secret',
      designatedOwnerEmail: 'owner@example.com',
      upsertUser,
    });

    expect(upsertUser).toHaveBeenCalledWith({
      email: 'user@example.com',
      role: SYSTEM_ROLE.MEMBER,
    });
    expect(result).toEqual(user);
  });

  it('upserts with role OWNER when the email matches designatedOwnerEmail', async () => {
    const user = makeUser({
      email: 'owner@example.com',
      role: SYSTEM_ROLE.OWNER,
    });
    const upsertUser = vi.fn().mockResolvedValue(user);

    const result = await resolveTrustedProxyUser({
      secret: 'correct-secret',
      email: 'owner@example.com',
      expectedSecret: 'correct-secret',
      designatedOwnerEmail: 'owner@example.com',
      upsertUser,
    });

    expect(upsertUser).toHaveBeenCalledWith({
      email: 'owner@example.com',
      role: SYSTEM_ROLE.OWNER,
    });
    expect(result).toEqual(user);
  });
});
