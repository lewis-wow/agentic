import { NodeEnv } from '@repo/enums';
import { createEnv } from '@repo/utils';
import { Schema } from 'effect';

// Effect Schema env validation (validated at startup).
export const env = createEnv({
  schema: {
    NODE_ENV: Schema.optionalWith(Schema.Enums(NodeEnv), {
      default: () => NodeEnv.DEVELOPMENT,
    }),
    API_PORT: Schema.optionalWith(Schema.NumberFromString, {
      default: () => 3001,
    }),
    DATABASE_URL: Schema.String,
    // base64-encoded PEM RS256 public key used to verify JWTs minted by the BFF.
    AUTH_PUBLIC_KEY: Schema.String,
  },
  runtimeEnv: process.env as Record<string, string | undefined>,
});
