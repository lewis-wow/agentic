import { createEnv } from '@repo/utils';
import { Schema } from 'effect';

export const env = createEnv({
  schema: {
    DATABASE_URL: Schema.String,
    BETTER_AUTH_SECRET: Schema.String,
    AUTH_PRIVATE_KEY: Schema.String,
    API_URL: Schema.optionalWith(Schema.String, {
      default: () => 'http://localhost:3001',
    }),
  },
  runtimeEnv: process.env as Record<string, string | undefined>,
});
