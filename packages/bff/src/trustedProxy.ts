import { SYSTEM_ROLE, type SystemRole } from '@repo/auth/roles';
import type { User } from '@repo/prisma';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export type TrustedProxyJwtVerifier = (jwt: string) => Promise<JWTPayload>;

export type CreateTrustedProxyJwtVerifierArgs = {
  jwksUrl: string;
  issuer: string;
  audience: string;
  /** Comma-separated allow-list of signing algorithms. Defaults to `'ES256'` (Pomerium's default). */
  algorithms?: string;
};

/**
 * Builds a Proxy Identity JWT verifier backed by a remote JWKS endpoint —
 * construct once per process (the returned `createRemoteJWKSet` owns an
 * in-memory key cache keyed by `kid`) and inject the result into every
 * request-time call to `resolveTrustedProxyUser`, never build one per
 * request. See docs/adr/0024-jwt-verified-trusted-proxy-identity.md.
 */
export const createTrustedProxyJwtVerifier = (
  args: CreateTrustedProxyJwtVerifierArgs,
): TrustedProxyJwtVerifier => {
  const jwks = createRemoteJWKSet(new URL(args.jwksUrl));
  const algorithms = (args.algorithms ?? 'ES256')
    .split(',')
    .map((algorithm) => algorithm.trim());

  return async (jwt: string): Promise<JWTPayload> => {
    const { payload } = await jwtVerify(jwt, jwks, {
      issuer: args.issuer,
      audience: args.audience,
      algorithms,
    });
    return payload;
  };
};

type GetClaimAtPathArgs = {
  payload: JWTPayload;
  path: string;
};

/**
 * Resolves a dot-separated claim path (e.g. `claims.email`) to a string,
 * handling both a plain string claim and a single-element array claim
 * (Pomerium nests OIDC claims as arrays). Any other shape resolves to
 * `undefined`.
 */
const getClaimAtPath = (args: GetClaimAtPathArgs): string | undefined => {
  const value = args.path.split('.').reduce<unknown>((current, key) => {
    if (typeof current !== 'object' || current === null) return undefined;
    return (current as Record<string, unknown>)[key];
  }, args.payload);

  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
};

export type ResolveTrustedProxyUserArgs = {
  jwt: string | undefined;
  verify: TrustedProxyJwtVerifier;
  emailClaimPath: string;
  designatedOwnerEmail: string;
  upsertUser: (args: { email: string; role: SystemRole }) => Promise<User>;
};

/**
 * Resolves the current request's identity via Trusted Proxy Authentication —
 * verifies the Proxy Identity JWT (signature, algorithm, issuer, audience,
 * expiry) via the injected verifier, then extracts the identity email at
 * `emailClaimPath`. Fails closed: a missing JWT, a verification failure, or
 * an unresolvable email all return `null` without ever calling `upsertUser`.
 */
export const resolveTrustedProxyUser = async (
  args: ResolveTrustedProxyUserArgs,
): Promise<User | null> => {
  if (!args.jwt) return null;

  let payload: JWTPayload;
  try {
    payload = await args.verify(args.jwt);
  } catch {
    return null;
  }

  const email = getClaimAtPath({ payload, path: args.emailClaimPath });
  if (!email) return null;

  const role =
    email === args.designatedOwnerEmail
      ? SYSTEM_ROLE.OWNER
      : SYSTEM_ROLE.MEMBER;

  return args.upsertUser({ email, role });
};
