import { serve } from '@hono/node-server';
import { decodeBase64Pem } from '@repo/auth/jwt';
import { prisma } from '@repo/prisma';
import { Hono } from 'hono';
import type { Context } from 'hono';

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
  findEnvironment: (apiKey) =>
    prisma.environment.findUnique({ where: { apiKey } }),
  privateKeyPem,
});

app.use('/projects/:projectId/*', projectAuth);
app.use('/me', meAuth);
app.use('/sdk/*', sdkAuth);

/** Forward the (now authenticated) request to apps/api with the minted JWT. */
const forwardToApi = async (c: Context<AppEnv>): Promise<Response> => {
  const incoming = c.req.raw;
  const target = new URL(c.req.path, env.API_URL);
  target.search = new URL(incoming.url).search;

  const headers = new Headers(incoming.headers);
  headers.set('Authorization', `Bearer ${c.get('jwt')}`);

  const method = c.req.method;
  const body =
    method === 'GET' || method === 'HEAD'
      ? undefined
      : await c.req.arrayBuffer();

  const response = await fetch(target, { method, headers, body });

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
};

app.all('/projects/:projectId/*', forwardToApi);
app.all('/me', forwardToApi);
app.all('/sdk/*', forwardToApi);

serve({ fetch: app.fetch, port: env.BFF_PORT });
