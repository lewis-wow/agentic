import type { TrustedProxyJwtVerifier } from '@repo/bff';
import type { Environment, User } from '@repo/prisma';
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  jwtVerify,
  SignJWT,
  type CryptoKey,
  type JWTVerifyGetKey,
} from 'jose';
import { generateKeyPairSync } from 'node:crypto';

import type { ApiKeyLookupResult } from '../../src/auth/middleware.js';

export const generateTestKeys = (): {
  privateKey: string;
  publicKey: string;
} => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { privateKey, publicKey };
};

export const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  emailVerified: true,
  image: null,
  role: 'MEMBER',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const makeEnvironment = (
  overrides: Partial<Environment> = {},
): Environment => ({
  id: 'env-1',
  name: 'development',
  projectId: 'project-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const makeApiKey = (
  overrides: Partial<ApiKeyLookupResult> = {},
): ApiKeyLookupResult => ({
  apiKeyHash: '$2a$10$placeholder',
  revokedAt: null,
  environmentId: 'env-1',
  environment: { projectId: 'project-1' },
  ...overrides,
});

const TEST_KID = 'test-key';
const TEST_ALG = 'ES256';

/**
 * Generates an ES256 keypair and a matching local JWKS (`jose.createLocalJWKSet`)
 * for signing/verifying test Proxy Identity JWTs with no real network fetch.
 */
export const generateTestJwksKeypair = async (): Promise<{
  privateKey: CryptoKey;
  jwks: JWTVerifyGetKey;
}> => {
  const { privateKey, publicKey } = await generateKeyPair(TEST_ALG, {
    extractable: true,
  });
  const jwk = await exportJWK(publicKey);
  jwk.kid = TEST_KID;
  jwk.alg = TEST_ALG;
  return { privateKey, jwks: createLocalJWKSet({ keys: [jwk] }) };
};

export type SignTestProxyJwtArgs = {
  privateKey: CryptoKey;
  issuer: string;
  audience: string;
  /** Omit to sign a token with no email claim at all (for testing claim-resolution failure). */
  email?: string;
  /** Unix seconds. Defaults to five minutes from now. */
  expiresAt?: number;
  /** Overrides the signing algorithm/kid asserted in the protected header. */
  alg?: string;
  kid?: string;
};

/** Signs a test Proxy Identity JWT, nesting the email as `claims.email` (Pomerium's shape). */
export const signTestProxyJwt = (args: SignTestProxyJwtArgs): Promise<string> =>
  new SignJWT(
    args.email === undefined
      ? { claims: {} }
      : { claims: { email: [args.email] } },
  )
    .setProtectedHeader({
      alg: args.alg ?? TEST_ALG,
      kid: args.kid ?? TEST_KID,
    })
    .setIssuer(args.issuer)
    .setAudience(args.audience)
    .setIssuedAt()
    .setExpirationTime(args.expiresAt ?? Math.floor(Date.now() / 1000) + 300)
    .sign(args.privateKey);

export type CreateTestTrustedProxyJwtVerifierArgs = {
  jwks: JWTVerifyGetKey;
  issuer: string;
  audience: string;
  algorithms?: string[];
};

/**
 * Test stand-in for `createTrustedProxyJwtVerifier` (`@repo/bff`), which only
 * builds a remote (network-fetching) JWKS client. Same verification options,
 * a local (non-network) key source instead.
 */
export const createTestTrustedProxyJwtVerifier =
  (args: CreateTestTrustedProxyJwtVerifierArgs): TrustedProxyJwtVerifier =>
  async (jwt: string) => {
    const { payload } = await jwtVerify(jwt, args.jwks, {
      issuer: args.issuer,
      audience: args.audience,
      algorithms: args.algorithms ?? [TEST_ALG],
    });
    return payload;
  };
