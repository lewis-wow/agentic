import { verifyRs256 } from '@repo/auth/jwt';
import type { SystemRole } from '@repo/auth/roles';
import { Hono } from 'hono';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  type AuthVariables,
  createTrustedProxyMeAuthMiddleware,
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

const buildApp = (
  upsertUser: ReturnType<typeof vi.fn>,
): Hono<{ Variables: AuthVariables }> => {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use(
    '/me',
    createTrustedProxyMeAuthMiddleware({
      upsertUser,
      privateKeyPem: rsaPrivateKey,
      designatedOwnerEmail: OWNER_EMAIL,
      jwtHeaderName: JWT_HEADER,
      verify,
      emailClaimPath: 'claims.email',
    }),
  );
  app.get('/me', (c) => c.json({ jwt: c.get('jwt'), claims: c.get('claims') }));
  return app;
};

const signValidJwt = (email: string): Promise<string> =>
  signTestProxyJwt({
    privateKey: jwksPrivateKey,
    issuer: ISSUER,
    audience: AUDIENCE,
    email,
  });

describe('trusted proxy me auth middleware', () => {
  it('mints a JWT carrying only userId and systemRole for an owner', async () => {
    const upsertUser = vi
      .fn()
      .mockResolvedValue(
        makeUser({ id: 'owner-1', email: OWNER_EMAIL, role: 'OWNER' }),
      );
    const app = buildApp(upsertUser);
    const jwt = await signValidJwt(OWNER_EMAIL);

    const res = await app.request('/me', {
      headers: { [JWT_HEADER]: jwt },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claims).toEqual({ userId: 'owner-1', systemRole: 'OWNER' });
    expect(upsertUser).toHaveBeenCalledWith({
      email: OWNER_EMAIL,
      role: 'OWNER' satisfies SystemRole,
    });

    const verified = verifyRs256({
      token: body.jwt,
      publicKeyPem: rsaPublicKey,
    });
    expect(verified).toMatchObject({ userId: 'owner-1', systemRole: 'OWNER' });
  });

  it('mints a JWT for a member', async () => {
    const upsertUser = vi.fn().mockResolvedValue(
      makeUser({
        id: 'member-1',
        email: 'member@example.com',
        role: 'MEMBER',
      }),
    );
    const app = buildApp(upsertUser);
    const jwt = await signValidJwt('member@example.com');

    const res = await app.request('/me', {
      headers: { [JWT_HEADER]: jwt },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claims).toEqual({ userId: 'member-1', systemRole: 'MEMBER' });
  });

  it('returns 401 when the Proxy Identity JWT header is missing', async () => {
    const upsertUser = vi.fn();
    const app = buildApp(upsertUser);

    const res = await app.request('/me');

    expect(res.status).toBe(401);
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it('returns 401 when the email claim cannot be resolved', async () => {
    const upsertUser = vi.fn();
    const app = buildApp(upsertUser);
    const jwt = await signTestProxyJwt({
      privateKey: jwksPrivateKey,
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    const res = await app.request('/me', {
      headers: { [JWT_HEADER]: jwt },
    });

    expect(res.status).toBe(401);
    expect(upsertUser).not.toHaveBeenCalled();
  });
});
