import { SYSTEM_ROLE } from '@repo/auth/roles';
import type { User } from '@repo/prisma';
import type { JWTPayload } from 'jose';
import { describe, expect, it, vi } from 'vitest';

import {
  resolveTrustedProxyUser,
  type TrustedProxyJwtVerifier,
} from '../../src/trustedProxy.js';

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

const OWNER_EMAIL = 'owner@example.com';
const EMAIL_CLAIM_PATH = 'claims.email';

/** A fake verifier standing in for `createTrustedProxyJwtVerifier`'s real jose-backed one. */
const fakeVerifier = (payload: JWTPayload): TrustedProxyJwtVerifier =>
  vi.fn().mockResolvedValue(payload);

const rejectingVerifier = (): TrustedProxyJwtVerifier =>
  vi.fn().mockRejectedValue(new Error('signature verification failed'));

describe('resolveTrustedProxyUser', () => {
  it('returns null without calling verify when the JWT is missing', async () => {
    const verify = fakeVerifier({ claims: { email: ['user@example.com'] } });
    const upsertUser = vi.fn();

    const result = await resolveTrustedProxyUser({
      jwt: undefined,
      verify,
      emailClaimPath: EMAIL_CLAIM_PATH,
      designatedOwnerEmail: OWNER_EMAIL,
      upsertUser,
    });

    expect(result).toBeNull();
    expect(verify).not.toHaveBeenCalled();
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it('returns null when verify rejects (bad signature, disallowed algorithm, issuer/audience mismatch, or expired)', async () => {
    const verify = rejectingVerifier();
    const upsertUser = vi.fn();

    const result = await resolveTrustedProxyUser({
      jwt: 'header.payload.signature',
      verify,
      emailClaimPath: EMAIL_CLAIM_PATH,
      designatedOwnerEmail: OWNER_EMAIL,
      upsertUser,
    });

    expect(result).toBeNull();
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it('returns null when the email claim path resolves to nothing', async () => {
    const verify = fakeVerifier({ claims: {} });
    const upsertUser = vi.fn();

    const result = await resolveTrustedProxyUser({
      jwt: 'header.payload.signature',
      verify,
      emailClaimPath: EMAIL_CLAIM_PATH,
      designatedOwnerEmail: OWNER_EMAIL,
      upsertUser,
    });

    expect(result).toBeNull();
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it('returns null when the email claim is a malformed type (e.g. a number)', async () => {
    const verify = fakeVerifier({ claims: { email: 12345 } });
    const upsertUser = vi.fn();

    const result = await resolveTrustedProxyUser({
      jwt: 'header.payload.signature',
      verify,
      emailClaimPath: EMAIL_CLAIM_PATH,
      designatedOwnerEmail: OWNER_EMAIL,
      upsertUser,
    });

    expect(result).toBeNull();
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it('resolves the email from a single-element array claim (Pomerium shape) and upserts as MEMBER', async () => {
    const user = makeUser({
      email: 'user@example.com',
      role: SYSTEM_ROLE.MEMBER,
    });
    const verify = fakeVerifier({ claims: { email: ['user@example.com'] } });
    const upsertUser = vi.fn().mockResolvedValue(user);

    const result = await resolveTrustedProxyUser({
      jwt: 'header.payload.signature',
      verify,
      emailClaimPath: EMAIL_CLAIM_PATH,
      designatedOwnerEmail: OWNER_EMAIL,
      upsertUser,
    });

    expect(upsertUser).toHaveBeenCalledWith({
      email: 'user@example.com',
      role: SYSTEM_ROLE.MEMBER,
    });
    expect(result).toEqual(user);
  });

  it('resolves the email from a plain string claim and upserts as MEMBER', async () => {
    const user = makeUser({
      email: 'user@example.com',
      role: SYSTEM_ROLE.MEMBER,
    });
    const verify = fakeVerifier({ claims: { email: 'user@example.com' } });
    const upsertUser = vi.fn().mockResolvedValue(user);

    const result = await resolveTrustedProxyUser({
      jwt: 'header.payload.signature',
      verify,
      emailClaimPath: EMAIL_CLAIM_PATH,
      designatedOwnerEmail: OWNER_EMAIL,
      upsertUser,
    });

    expect(upsertUser).toHaveBeenCalledWith({
      email: 'user@example.com',
      role: SYSTEM_ROLE.MEMBER,
    });
    expect(result).toEqual(user);
  });

  it('upserts with role OWNER when the resolved email matches designatedOwnerEmail', async () => {
    const user = makeUser({ email: OWNER_EMAIL, role: SYSTEM_ROLE.OWNER });
    const verify = fakeVerifier({ claims: { email: [OWNER_EMAIL] } });
    const upsertUser = vi.fn().mockResolvedValue(user);

    const result = await resolveTrustedProxyUser({
      jwt: 'header.payload.signature',
      verify,
      emailClaimPath: EMAIL_CLAIM_PATH,
      designatedOwnerEmail: OWNER_EMAIL,
      upsertUser,
    });

    expect(upsertUser).toHaveBeenCalledWith({
      email: OWNER_EMAIL,
      role: SYSTEM_ROLE.OWNER,
    });
    expect(result).toEqual(user);
  });

  it('resolves a top-level (non-nested) claim path', async () => {
    const user = makeUser({
      email: 'user@example.com',
      role: SYSTEM_ROLE.MEMBER,
    });
    const verify = fakeVerifier({ email: 'user@example.com' });
    const upsertUser = vi.fn().mockResolvedValue(user);

    const result = await resolveTrustedProxyUser({
      jwt: 'header.payload.signature',
      verify,
      emailClaimPath: 'email',
      designatedOwnerEmail: OWNER_EMAIL,
      upsertUser,
    });

    expect(upsertUser).toHaveBeenCalledWith({
      email: 'user@example.com',
      role: SYSTEM_ROLE.MEMBER,
    });
    expect(result).toEqual(user);
  });
});
