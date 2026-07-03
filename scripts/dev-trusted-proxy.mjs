#!/usr/bin/env node
// Stand-in for a real reverse proxy (oauth2-proxy, Authelia, Pomerium, ...) in
// local development. Trusted Proxy Authentication requires every request to
// carry an Identity Header and a Trusted Proxy Secret — this script injects
// both on every request it forwards, so `apps/dashboard`'s own code path
// never branches on "am I in dev" (see .issues/auth.md, "Local dev").
//
// Usage: node scripts/dev-trusted-proxy.mjs
// Then visit http://localhost:4000 instead of http://localhost:3000 directly.
import http from 'node:http';

const TARGET_PORT = process.env.TRUSTED_PROXY_DEV_TARGET_PORT ?? '3000';
const PROXY_PORT = process.env.TRUSTED_PROXY_DEV_PROXY_PORT ?? '4000';
const IDENTITY_HEADER =
  process.env.TRUSTED_PROXY_IDENTITY_HEADER ?? 'X-Forwarded-Email';
const EMAIL = process.env.TRUSTED_PROXY_DEV_EMAIL ?? 'owner@example.com';
const SECRET =
  process.env.TRUSTED_PROXY_SECRET ?? 'dev-secret-change-in-production';

const server = http.createServer((req, res) => {
  const proxyReq = http.request(
    {
      hostname: 'localhost',
      port: TARGET_PORT,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        [IDENTITY_HEADER]: EMAIL,
        'X-Trusted-Proxy-Secret': SECRET,
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
    `dev-trusted-proxy: forwarding http://localhost:${PROXY_PORT} -> http://localhost:${TARGET_PORT}, asserting ${IDENTITY_HEADER}: ${EMAIL}`,
  );
});
