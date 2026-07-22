import { verifyRs256 } from '@repo/auth/jwt';
import type { SystemRole } from '@repo/auth/roles';
import { Hono } from 'hono';
import { createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  type AuthVariables,
  createTrustedProxyProjectAuthMiddleware,
} from '../../src/auth/middleware.js';
import {
  createTestTrustedProxyJwtVerifier,
  generateTestJwksKeypair,
  generateTestKeys,
  makeUser,
  signTestProxyJwt,
} from '../helpers/factories.js';

const { privateKey: rsaPrivateKey, publicKey: rsaPublicKey } =
  generateTestKeys();

const OWNER_EMAIL = 'owner@example.com';
const ISSUER = 'https://authenticate.proxy.example';
const AUDIENCE = 'featureflags';
const JWT_HEADER = 'X-Pomerium-Jwt-Assertion';

let jwksPrivateKey: Awaited<
  ReturnType<typeof generateTestJwksKeypair>
>['privateKey'];
let verify: ReturnType<typeof createTestTrustedProxyJwtVerifier>;

beforeAll(async () => {
  const keypair = await generateTestJwksKeypair();
  jwksPrivateKey = keypair.privateKey;
  verify = createTestTrustedProxyJwtVerifier({
    jwks: keypair.jwks,
    issuer: ISSUER,
    audience: AUDIENCE,
  });
});

type AppDeps = {
  upsertUser: ReturnType<typeof vi.fn>;
  /** Overrides the module-level `verify` — used to test against a differently-configured JWKS/allow-list. */
  verify?: ReturnType<typeof createTestTrustedProxyJwtVerifier>;
};

const buildApp = (deps: AppDeps): Hono<{ Variables: AuthVariables }> => {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use(
    '/projects/:projectId/*',
    createTrustedProxyProjectAuthMiddleware({
      upsertUser: deps.upsertUser,
      privateKeyPem: rsaPrivateKey,
      designatedOwnerEmail: OWNER_EMAIL,
      jwtHeaderName: JWT_HEADER,
      verify: deps.verify ?? verify,
      emailClaimPath: 'claims.email',
    }),
  );
  app.get('/projects/:projectId/flags', (c) =>
    c.json({ jwt: c.get('jwt'), claims: c.get('claims') }),
  );
  return app;
};

const signValidJwt = (email: string): Promise<string> =>
  signTestProxyJwt({
    privateKey: jwksPrivateKey,
    issuer: ISSUER,
    audience: AUDIENCE,
    email,
  });

describe('trusted proxy project auth middleware', () => {
  it('mints an owner JWT', async () => {
    const upsertUser = vi
      .fn()
      .mockResolvedValue(
        makeUser({ id: 'owner-1', email: OWNER_EMAIL, role: 'OWNER' }),
      );
    const app = buildApp({ upsertUser });
    const jwt = await signValidJwt(OWNER_EMAIL);

    const res = await app.request('/projects/project-1/flags', {
      headers: { [JWT_HEADER]: jwt },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claims).toMatchObject({
      userId: 'owner-1',
      systemRole: 'OWNER',
      projectId: 'project-1',
      projectRole: 'owner',
    });
    expect(upsertUser).toHaveBeenCalledWith({
      email: OWNER_EMAIL,
      role: 'OWNER' satisfies SystemRole,
    });

    const verified = verifyRs256({
      token: body.jwt,
      publicKeyPem: rsaPublicKey,
    });
    expect(verified.projectRole).toBe('owner');
  });

  it('returns 403 for a non-owner — project access is owner-only', async () => {
    const upsertUser = vi
      .fn()
      .mockResolvedValue(
        makeUser({ email: 'member@example.com', role: 'MEMBER' }),
      );
    const app = buildApp({ upsertUser });
    const jwt = await signValidJwt('member@example.com');

    const res = await app.request('/projects/project-1/flags', {
      headers: { [JWT_HEADER]: jwt },
    });

    expect(res.status).toBe(403);
  });

  it('returns 401 when the Proxy Identity JWT header is missing', async () => {
    const upsertUser = vi.fn();
    const app = buildApp({ upsertUser });

    const res = await app.request('/projects/project-1/flags');

    expect(res.status).toBe(401);
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it('returns 401 for a malformed/tampered token', async () => {
    const upsertUser = vi.fn();
    const app = buildApp({ upsertUser });
    const jwt = await signValidJwt('member@example.com');

    const res = await app.request('/projects/project-1/flags', {
      headers: { [JWT_HEADER]: `${jwt}tampered` },
    });

    expect(res.status).toBe(401);
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it('returns 401 when the issuer does not match', async () => {
    const upsertUser = vi.fn();
    const app = buildApp({ upsertUser });
    const jwt = await signTestProxyJwt({
      privateKey: jwksPrivateKey,
      issuer: 'https://a-different-proxy.example',
      audience: AUDIENCE,
      email: 'member@example.com',
    });

    const res = await app.request('/projects/project-1/flags', {
      headers: { [JWT_HEADER]: jwt },
    });

    expect(res.status).toBe(401);
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it('returns 401 when the audience does not match', async () => {
    const upsertUser = vi.fn();
    const app = buildApp({ upsertUser });
    const jwt = await signTestProxyJwt({
      privateKey: jwksPrivateKey,
      issuer: ISSUER,
      audience: 'a-different-application',
      email: 'member@example.com',
    });

    const res = await app.request('/projects/project-1/flags', {
      headers: { [JWT_HEADER]: jwt },
    });

    expect(res.status).toBe(401);
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it('returns 401 for an expired token', async () => {
    const upsertUser = vi.fn();
    const app = buildApp({ upsertUser });
    const jwt = await signTestProxyJwt({
      privateKey: jwksPrivateKey,
      issuer: ISSUER,
      audience: AUDIENCE,
      email: 'member@example.com',
      expiresAt: Math.floor(Date.now() / 1000) - 10,
    });

    const res = await app.request('/projects/project-1/flags', {
      headers: { [JWT_HEADER]: jwt },
    });

    expect(res.status).toBe(401);
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it('returns 401 when the token is signed with a kid the JWKS does not have', async () => {
    const upsertUser = vi.fn();
    const app = buildApp({ upsertUser });
    // A different keypair entirely — its public key was never added to the JWKS `verify` resolves against.
    const rogueKeypair = await generateTestJwksKeypair();
    const jwt = await signTestProxyJwt({
      privateKey: rogueKeypair.privateKey,
      issuer: ISSUER,
      audience: AUDIENCE,
      email: 'member@example.com',
      kid: 'rogue-key',
    });

    const res = await app.request('/projects/project-1/flags', {
      headers: { [JWT_HEADER]: jwt },
    });

    expect(res.status).toBe(401);
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it('returns 401 when the token is signed with an algorithm outside the allow-list', async () => {
    // The RS256 key is present in the JWKS `verify` resolves against (with a
    // matching kid), so rejection below is specifically because 'RS256' isn't
    // in the ES256-only allow-list — not because the key can't be found.
    const { privateKey: rsaPrivateKey2, publicKey: rsaPublicKey2 } =
      await generateKeyPair('RS256', { extractable: true });
    const rsaJwk = await exportJWK(rsaPublicKey2);
    rsaJwk.kid = 'rsa-key';
    rsaJwk.alg = 'RS256';
    const verifyEs256Only = createTestTrustedProxyJwtVerifier({
      jwks: createLocalJWKSet({ keys: [rsaJwk] }),
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const upsertUser = vi.fn();
    const app = buildApp({ upsertUser, verify: verifyEs256Only });

    const jwt = await signTestProxyJwt({
      privateKey: rsaPrivateKey2,
      issuer: ISSUER,
      audience: AUDIENCE,
      email: 'member@example.com',
      alg: 'RS256',
      kid: 'rsa-key',
    });

    const res = await app.request('/projects/project-1/flags', {
      headers: { [JWT_HEADER]: jwt },
    });

    expect(res.status).toBe(401);
    expect(upsertUser).not.toHaveBeenCalled();
  });
});
