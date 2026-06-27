import { serve } from '@hono/node-server';
import { Hono } from 'hono';

import { env } from './env.js';

const app = new Hono();

app.get('/', (c) => c.json({ status: 'ok' }));

serve({ fetch: app.fetch, port: env.BFF_PORT });
