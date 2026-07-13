// Hono app entry point (@hono/node-server).
import { serve } from '@hono/node-server';
import { decodeBase64Pem } from '@repo/auth/jwt';
import { forwardWithJwt, type UpsertUserArgs, UserService } from '@repo/bff';
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

const userService = new UserService({ prisma });

const trustedProxyOptions = {
  privateKeyPem,
  expectedSecret: env.TRUSTED_PROXY_SECRET,
  designatedOwnerEmail: env.TRUSTED_PROXY_OWNER_EMAIL,
  identityHeaderName: env.TRUSTED_PROXY_IDENTITY_HEADER,
  upsertUser: (args: UpsertUserArgs) => userService.upsert(args),
};

const projectAuth =
  createTrustedProxyProjectAuthMiddleware(trustedProxyOptions);

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

serve({ fetch: app.fetch, port: env.BFF_PORT }, (info) => {
  console.log(`BFF listening at http://localhost:${info.port}`);
});
