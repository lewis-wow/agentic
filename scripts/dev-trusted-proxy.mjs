#!/usr/bin/env node
// Stand-in for a JWT-capable reverse proxy (Pomerium, GCP IAP, Cloudflare
// Access, ...) in local development. Trusted Proxy Authentication verifies a
// signed Proxy Identity JWT against a JWKS endpoint (see
// docs/adr/0024-jwt-verified-trusted-proxy-identity.md) — this script mints
// one on every forwarded request and serves the matching JWKS, so
// apps/bff's and apps/dashboard's own code paths never branch on "am I in
// dev".
//
// Usage: node scripts/dev-trusted-proxy.mjs
// Then visit http://localhost:4000 instead of http://localhost:3000 directly.
import http from 'node:http';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

const TARGET_PORT = process.env.TRUSTED_PROXY_DEV_TARGET_PORT ?? '3000';
const PROXY_PORT = process.env.TRUSTED_PROXY_DEV_PROXY_PORT ?? '4000';
const JWKS_PORT = process.env.TRUSTED_PROXY_DEV_JWKS_PORT ?? '4444';
const JWT_HEADER =
  process.env.TRUSTED_PROXY_JWT_HEADER ?? 'X-Pomerium-Jwt-Assertion';
const EMAIL_CLAIM_PATH =
  process.env.TRUSTED_PROXY_JWT_EMAIL_CLAIM ?? 'claims.email';
const ISSUER = process.env.TRUSTED_PROXY_JWT_ISSUER ?? 'https://authenticate.localhost';
const AUDIENCE = process.env.TRUSTED_PROXY_JWT_AUDIENCE ?? 'dashboard.localhost';
const ALGORITHM = (process.env.TRUSTED_PROXY_JWT_ALGORITHM ?? 'ES256')
  .split(',')[0]
  .trim();
const EMAIL = process.env.TRUSTED_PROXY_DEV_EMAIL ?? 'owner@example.com';
const KID = 'dev-trusted-proxy';

const { publicKey, privateKey } = await generateKeyPair(ALGORITHM, {
  extractable: true,
});
const publicJwk = {
  ...(await exportJWK(publicKey)),
  kid: KID,
  alg: ALGORITHM,
  use: 'sig',
};

/**
 * Builds the nested claims object `resolveTrustedProxyUser`'s `getClaimAtPath`
 * expects at `emailClaimPath` (e.g. `claims.email` -> `{ claims: { email:
 * [EMAIL] } }`), mirroring Pomerium's array-wrapped OIDC claim shape.
 */
const buildClaims = (path, email) => {
  const keys = path.split('.');
  const leaf = keys.pop();
  const root = {};
  let cursor = root;
  for (const key of keys) {
    cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[leaf] = [email];
  return root;
};

const mintJwt = () =>
  new SignJWT(buildClaims(EMAIL_CLAIM_PATH, EMAIL))
    .setProtectedHeader({ alg: ALGORITHM, kid: KID })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);

const jwksServer = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ keys: [publicJwk] }));
});

jwksServer.listen(JWKS_PORT, () => {
  console.log(`dev-trusted-proxy: serving JWKS at http://localhost:${JWKS_PORT}/`);
});

const server = http.createServer(async (req, res) => {
  const jwt = await mintJwt();

  const proxyReq = http.request(
    {
      hostname: 'localhost',
      port: TARGET_PORT,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        [JWT_HEADER]: jwt,
      },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', (error) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end(`dev-trusted-proxy: upstream error: ${error.message}`);
  });

  req.pipe(proxyReq);
});

server.listen(PROXY_PORT, () => {
  console.log(
    `dev-trusted-proxy: forwarding http://localhost:${PROXY_PORT} -> http://localhost:${TARGET_PORT}, asserting ${JWT_HEADER} for ${EMAIL}`,
  );
});
