import { serve } from '@hono/node-server';
import { decodeBase64Pem } from '@repo/auth/jwt';
import type { SystemRole } from '@repo/auth/roles';
import { forwardWithJwt } from '@repo/bff';
import { prisma } from '@repo/prisma';
import { Hono } from 'hono';

import {
  type AuthVariables,
  createSdkAuthMiddleware,
  createTrustedProxyMeAuthMiddleware,
  createTrustedProxyProjectAuthMiddleware,
} from './auth/middleware.js';
import { env } from './env.js';

type AppEnv = { Variables: AuthVariables };

const privateKeyPem = decodeBase64Pem(env.AUTH_PRIVATE_KEY);

const app = new Hono<AppEnv>();

app.get('/', (c) => c.json({ status: 'ok' }));
app.get('/health', (c) => c.json({ status: 'ok' }));

const trustedProxyOptions = {
  privateKeyPem,
  expectedSecret: env.TRUSTED_PROXY_SECRET,
  designatedOwnerEmail: env.TRUSTED_PROXY_OWNER_EMAIL,
  identityHeaderName: env.TRUSTED_PROXY_IDENTITY_HEADER,
  upsertUser: ({ email, role }: { email: string; role: SystemRole }) =>
    prisma.user.upsert({
      where: { email },
      create: { email, name: email, role },
      update: {},
    }),
};

const projectAuth = createTrustedProxyProjectAuthMiddleware({
  ...trustedProxyOptions,
  findMembership: (userId, projectId) =>
    prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    }),
});

const meAuth = createTrustedProxyMeAuthMiddleware(trustedProxyOptions);

const sdkAuth = createSdkAuthMiddleware({
  findApiKey: (apiKeyId) =>
    prisma.apiKey.findUnique({
      where: { apiKeyId },
      select: {
        apiKeyHash: true,
        revokedAt: true,
        environmentId: true,
        environment: { select: { projectId: true } },
      },
    }),
  privateKeyPem,
});

app.use('/projects', meAuth);
app.use('/projects/:projectId/*', projectAuth);
app.use('/me', meAuth);
app.use('/v1/*', sdkAuth);

app.all('/projects', (c) =>
  forwardWithJwt(c.req.raw, c.get('jwt'), env.API_URL),
);
app.all('/projects/:projectId/*', (c) =>
  forwardWithJwt(c.req.raw, c.get('jwt'), env.API_URL),
);
app.all('/me', (c) => forwardWithJwt(c.req.raw, c.get('jwt'), env.API_URL));
app.all('/v1/*', (c) => forwardWithJwt(c.req.raw, c.get('jwt'), env.API_URL));

serve({ fetch: app.fetch, port: env.BFF_PORT });
