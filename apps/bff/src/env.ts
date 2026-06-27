import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const NodeEnv = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
} as const;

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(NodeEnv).default(NodeEnv.DEVELOPMENT),
    BFF_PORT: z.coerce.number().default(3000),
  },
  runtimeEnv: process.env,
});
