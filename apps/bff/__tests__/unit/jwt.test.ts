import { JwtError, signRs256, verifyRs256 } from '@repo/auth/jwt';
import { describe, expect, it } from 'vitest';

import { generateTestKeys } from '../helpers/factories.js';

describe('RS256 JWT', () => {
  it('round-trips claims', () => {
    const { privateKey, publicKey } = generateTestKeys();

    const token = signRs256({
      payload: { userId: 'u1', projectRole: 'owner' },
      privateKeyPem: privateKey,
      expiresInSeconds: 60,
    });

    const claims = verifyRs256({ token, publicKeyPem: publicKey });

    expect(claims.userId).toBe('u1');
    expect(claims.projectRole).toBe('owner');
    expect(typeof claims.iat).toBe('number');
    expect(typeof claims.exp).toBe('number');
  });

  it('rejects an expired token', () => {
    const { privateKey, publicKey } = generateTestKeys();

    const token = signRs256({
      payload: { userId: 'u1' },
      privateKeyPem: privateKey,
      expiresInSeconds: -10,
    });

    expect(() => verifyRs256({ token, publicKeyPem: publicKey })).toThrow(
      JwtError,
    );
  });

  it('rejects a tampered signature', () => {
    const { privateKey, publicKey } = generateTestKeys();

    const token = signRs256({
      payload: { userId: 'u1' },
      privateKeyPem: privateKey,
      expiresInSeconds: 60,
    });

    const last = token.slice(-3);
    const tampered = token.slice(0, -3) + (last === 'AAA' ? 'BBB' : 'AAA');

    expect(() =>
      verifyRs256({ token: tampered, publicKeyPem: publicKey }),
    ).toThrow(JwtError);
  });

  it('rejects a token signed by a different key', () => {
    const signer = generateTestKeys();
    const other = generateTestKeys();

    const token = signRs256({
      payload: { userId: 'u1' },
      privateKeyPem: signer.privateKey,
      expiresInSeconds: 60,
    });

    expect(() => verifyRs256({ token, publicKeyPem: other.publicKey })).toThrow(
      JwtError,
    );
  });

  it('rejects a malformed token', () => {
    const { publicKey } = generateTestKeys();
    expect(() =>
      verifyRs256({ token: 'not-a-jwt', publicKeyPem: publicKey }),
    ).toThrow(JwtError);
  });
});
