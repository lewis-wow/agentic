import { serve } from '@hono/node-server';
import { SCALAR_REFERENCE_HTML } from '@repo/api';
import { decodeBase64Pem } from '@repo/auth/jwt';
import { HttpException } from '@repo/exception';
import { Hono } from 'hono';

import {
  type ApiAuthVariables,
  createJwtVerifyMiddleware,
} from './auth/middleware.js';
import { env } from './env.js';
import openApiDocument from './generated/openapi.json' with { type: 'json' };
import { apiKeysRouter } from './routes/apiKeys.js';
import { environmentsRouter } from './routes/environments.js';
import { flagsRouter } from './routes/flags.js';
import { projectsRouter } from './routes/projects.js';
import { sdkRouter } from './routes/sdk.js';

type AppEnv = { Variables: ApiAuthVariables };

const publicKeyPem = decodeBase64Pem(env.AUTH_PUBLIC_KEY);

const app = new Hono<AppEnv>();

app.get('/', (c) => c.json({ status: 'ok' }));

app.get('/openapi.json', (c) => c.json(openApiDocument));
app.get('/docs', (c) => c.html(SCALAR_REFERENCE_HTML));

const jwtAuth = createJwtVerifyMiddleware({ publicKeyPem });

app.use('/projects', jwtAuth);
app.use('/projects/:projectId', jwtAuth);
app.use('/projects/:projectId/*', jwtAuth);
app.use('/me', jwtAuth);
app.use('/v1/*', jwtAuth);

app.get('/me', (c) => c.json({ auth: c.get('auth') }));

app.route('/projects', projectsRouter);
app.route('/projects/:projectId/flags', flagsRouter);
app.route('/projects/:projectId/environments', environmentsRouter);
app.route('/projects/:projectId/api-keys', apiKeysRouter);
app.route('/v1', sdkRouter);

// Route handlers either return `exception.toResponse()` directly, or (the
// convention for service-backed routes) let a thrown `HttpException`
// propagate up to here — either way it becomes the same structured
// { code, message } response, never Hono's generic error shape.
app.onError((err) => {
  if (err instanceof HttpException) return err.toResponse();
  throw err;
});

serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  console.log(`API listening at http://localhost:${info.port}`);
});
