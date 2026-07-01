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
    NEXT_PUBLIC_APP_URL: Schema.optionalWith(Schema.String, {
      default: () => 'http://localhost:3000',
    }),
  },
  runtimeEnv: process.env as Record<string, string | undefined>,
  skipValidation: process.env.SKIP_ENV_VALIDATION === 'true',
});
