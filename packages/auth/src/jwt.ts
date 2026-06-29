import { createSign, createVerify } from 'node:crypto';

/**
 * Minimal, dependency-free RS256 JWT sign/verify built on Node's crypto.
 *
 * The BFF signs project-/SDK-scoped tokens with a private key; `apps/api`
 * verifies them with the matching public key and trusts the claims entirely.
 */

export class JwtError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JwtError';
  }
}

export type JwtClaims = Record<string, unknown> & {
  iat?: number;
  exp?: number;
};

type SignArgs = {
  payload: Record<string, unknown>;
  privateKeyPem: string;
  expiresInSeconds: number;
};

type VerifyArgs = {
  token: string;
  publicKeyPem: string;
};

const HEADER = { alg: 'RS256', typ: 'JWT' } as const;

const toBase64Url = (buf: Buffer): string =>
  buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const fromBase64Url = (value: string): Buffer =>
  Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

/**
 * Decode a base64-encoded PEM key (the env-var representation) into a PEM
 * string usable by Node's crypto.
 */
export const decodeBase64Pem = (base64Pem: string): string =>
  Buffer.from(base64Pem, 'base64').toString('utf8');

export const signRs256 = (args: SignArgs): string => {
  const iat = nowSeconds();
  const body = {
    ...args.payload,
    iat,
    exp: iat + args.expiresInSeconds,
  };

  const headerB64 = toBase64Url(Buffer.from(JSON.stringify(HEADER)));
  const bodyB64 = toBase64Url(Buffer.from(JSON.stringify(body)));
  const signingInput = `${headerB64}.${bodyB64}`;

  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = toBase64Url(signer.sign(args.privateKeyPem));

  return `${signingInput}.${signature}`;
};

export const verifyRs256 = <T extends JwtClaims = JwtClaims>(
  args: VerifyArgs,
): T => {
  const parts = args.token.split('.');
  const [headerB64, bodyB64, signatureB64] = parts;
  if (
    parts.length !== 3 ||
    headerB64 === undefined ||
    bodyB64 === undefined ||
    signatureB64 === undefined
  ) {
    throw new JwtError('Malformed token');
  }

  let header: { alg?: string };
  try {
    header = JSON.parse(fromBase64Url(headerB64).toString('utf8'));
  } catch {
    throw new JwtError('Malformed header');
  }

  if (header.alg !== HEADER.alg) {
    throw new JwtError('Unexpected algorithm');
  }

  const signingInput = `${headerB64}.${bodyB64}`;
  const verifier = createVerify('RSA-SHA256');
  verifier.update(signingInput);
  verifier.end();

  let valid: boolean;
  try {
    valid = verifier.verify(args.publicKeyPem, fromBase64Url(signatureB64));
  } catch {
    throw new JwtError('Signature verification failed');
  }

  if (!valid) {
    throw new JwtError('Invalid signature');
  }

  let payload: T;
  try {
    payload = JSON.parse(fromBase64Url(bodyB64).toString('utf8')) as T;
  } catch {
    throw new JwtError('Malformed payload');
  }

  if (typeof payload.exp === 'number' && payload.exp < nowSeconds()) {
    throw new JwtError('Token expired');
  }

  return payload;
};
