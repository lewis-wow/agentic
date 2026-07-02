import { serve } from '@hono/node-server';
import { decodeBase64Pem } from '@repo/auth/jwt';
import { Hono } from 'hono';

import {
  type ApiAuthVariables,
  createJwtVerifyMiddleware,
} from './auth/middleware.js';
import { env } from './env.js';
import { apiKeysRouter } from './routes/apiKeys.js';
import { environmentsRouter } from './routes/environments.js';
import { flagsRouter } from './routes/flags.js';
import { membersRouter } from './routes/members.js';
import { projectsRouter } from './routes/projects.js';
import { sdkRouter } from './routes/sdk.js';
import { usersRouter } from './routes/users.js';

type AppEnv = { Variables: ApiAuthVariables };

const publicKeyPem = decodeBase64Pem(env.AUTH_PUBLIC_KEY);

const app = new Hono<AppEnv>();

app.get('/', (c) => c.json({ status: 'ok' }));

const jwtAuth = createJwtVerifyMiddleware({ publicKeyPem });

app.use('/projects', jwtAuth);
app.use('/projects/:projectId', jwtAuth);
app.use('/projects/:projectId/*', jwtAuth);
app.use('/users', jwtAuth);
app.use('/me', jwtAuth);
app.use('/v1/*', jwtAuth);

app.get('/me', (c) => c.json({ auth: c.get('auth') }));

app.route('/projects', projectsRouter);
app.route('/projects/:projectId/flags', flagsRouter);
app.route('/projects/:projectId/environments', environmentsRouter);
app.route('/projects/:projectId/members', membersRouter);
app.route('/projects/:projectId/api-keys', apiKeysRouter);
app.route('/users', usersRouter);
app.route('/v1', sdkRouter);

serve({ fetch: app.fetch, port: env.API_PORT });
