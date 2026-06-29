import { serve } from '@hono/node-server';
import { decodeBase64Pem } from '@repo/auth/jwt';
import { forwardWithJwt } from '@repo/bff';
import { prisma } from '@repo/prisma';
import { Hono } from 'hono';

import {
  type AuthVariables,
  createMeAuthMiddleware,
  createProjectAuthMiddleware,
  createSdkAuthMiddleware,
} from './auth/middleware.js';
import { env } from './env.js';

type AppEnv = { Variables: AuthVariables };

const privateKeyPem = decodeBase64Pem(env.AUTH_PRIVATE_KEY);

const app = new Hono<AppEnv>();

app.get('/', (c) => c.json({ status: 'ok' }));

const projectAuth = createProjectAuthMiddleware({
  findSession: (token) =>
    prisma.session.findUnique({ where: { token }, include: { user: true } }),
  findMembership: (userId, projectId) =>
    prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    }),
  privateKeyPem,
});

const meAuth = createMeAuthMiddleware({
  findSession: (token) =>
    prisma.session.findUnique({ where: { token }, include: { user: true } }),
  privateKeyPem,
});

const sdkAuth = createSdkAuthMiddleware({
  findEnvironment: (apiKeyId) =>
    prisma.environment.findUnique({ where: { apiKeyId } }),
  privateKeyPem,
});

app.use('/projects/:projectId/*', projectAuth);
app.use('/me', meAuth);
app.use('/sdk/*', sdkAuth);

app.all('/projects/:projectId/*', (c) =>
  forwardWithJwt(c.req.raw, c.get('jwt'), env.API_URL),
);
app.all('/me', (c) => forwardWithJwt(c.req.raw, c.get('jwt'), env.API_URL));
app.all('/sdk/*', (c) => forwardWithJwt(c.req.raw, c.get('jwt'), env.API_URL));

serve({ fetch: app.fetch, port: env.BFF_PORT });
