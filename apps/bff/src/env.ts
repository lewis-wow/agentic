import { createEnv } from '@repo/utils';
import { Schema } from 'effect';

export const NodeEnv = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
} as const;

export const env = createEnv({
  schema: {
    NODE_ENV: Schema.optionalWith(
      Schema.Literal(NodeEnv.DEVELOPMENT, NodeEnv.PRODUCTION, NodeEnv.TEST),
      { default: () => NodeEnv.DEVELOPMENT },
    ),
    BFF_PORT: Schema.optionalWith(Schema.NumberFromString, {
      default: () => 3000,
    }),
    DATABASE_URL: Schema.String,
    // base64-encoded PEM RS256 private key used to sign project-/SDK-scoped JWTs.
    AUTH_PRIVATE_KEY: Schema.String,
    // Base URL of apps/api that authenticated requests are proxied to.
    API_URL: Schema.optionalWith(Schema.String, {
      default: () => 'http://localhost:3001',
    }),
  },
  runtimeEnv: process.env as Record<string, string | undefined>,
});
