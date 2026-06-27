import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    BFF_PORT: z.coerce.number().default(3000),
  },
  runtimeEnv: process.env,
});
