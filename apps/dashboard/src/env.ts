import { createEnv } from '@repo/utils';
import { Schema } from 'effect';

export const env = createEnv({
  schema: {
    DATABASE_URL: Schema.String,
    // Shared secret the reverse proxy must send on the fixed
    // X-Trusted-Proxy-Secret header for its identity header to be trusted.
    // Used locally for server-rendered page gating (guards.ts) — apps/bff
    // enforces the same check for the actual data path.
    TRUSTED_PROXY_SECRET: Schema.String,
    // Name of the header the reverse proxy uses to assert the user's email.
    TRUSTED_PROXY_IDENTITY_HEADER: Schema.optionalWith(Schema.String, {
      default: () => 'X-Forwarded-Email',
    }),
    // Email that becomes SYSTEM_ROLE.OWNER the first time it's seen.
    TRUSTED_PROXY_OWNER_EMAIL: Schema.String,
    // Base URL of apps/bff that the catch-all route forwards requests to.
    BFF_URL: Schema.optionalWith(Schema.String, {
      default: () => 'http://localhost:3002',
    }),
    // Optional: the reverse proxy's own sign-out URL (e.g. oauth2-proxy's
    // /oauth2/sign_out). There's no universal path across proxies, so the
    // logout button only renders when this is configured.
    TRUSTED_PROXY_LOGOUT_URL: Schema.optionalWith(Schema.String, {
      default: () => '',
    }),
    NEXT_PUBLIC_APP_URL: Schema.optionalWith(Schema.String, {
      default: () => 'http://localhost:3000',
    }),
  },
  runtimeEnv: process.env as Record<string, string | undefined>,
  skipValidation: process.env.SKIP_ENV_VALIDATION === 'true',
});
