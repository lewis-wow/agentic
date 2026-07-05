import { NodeEnv } from '@repo/enums';
import { createEnv } from '@repo/utils';
import { Schema } from 'effect';

// Effect Schema env validation (validated at startup).
export const env = createEnv({
  schema: {
    NODE_ENV: Schema.optionalWith(Schema.Enums(NodeEnv), {
      default: () => NodeEnv.DEVELOPMENT,
    }),
    BFF_PORT: Schema.optionalWith(Schema.NumberFromString, {
      default: () => 3000,
    }),
    DATABASE_URL: Schema.String,
    // base64-encoded PEM RS256 private key used to sign project-/SDK-scoped JWTs.
    AUTH_PRIVATE_KEY: Schema.String,
    // Shared secret the reverse proxy must send on the fixed
    // X-Trusted-Proxy-Secret header for its identity header to be trusted.
    TRUSTED_PROXY_SECRET: Schema.String,
    // Name of the header the reverse proxy uses to assert the user's email.
    // Configurable because oauth2-proxy/Authelia/Pomerium each default differently.
    TRUSTED_PROXY_IDENTITY_HEADER: Schema.optionalWith(Schema.String, {
      default: () => 'X-Forwarded-Email',
    }),
    // Email that becomes SYSTEM_ROLE.OWNER the first time it's seen.
    TRUSTED_PROXY_OWNER_EMAIL: Schema.String,
    // Base URL of apps/api that authenticated requests are proxied to.
    API_URL: Schema.optionalWith(Schema.String, {
      default: () => 'http://localhost:3001',
    }),
  },
  runtimeEnv: process.env as Record<string, string | undefined>,
});
