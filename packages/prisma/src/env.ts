import { createEnv } from '@repo/utils';
import { Schema } from 'effect';

export const env = createEnv({
  schema: {
    DATABASE_URL: Schema.String,
  },
  runtimeEnv: process.env as Record<string, string | undefined>,
});
