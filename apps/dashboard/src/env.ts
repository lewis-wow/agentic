import { createEnv } from '@repo/utils';
import { Schema } from 'effect';

export const env = createEnv({
  schema: {
    DATABASE_URL: Schema.String,
    // Name of the header the reverse proxy sets with the signed Proxy
    // Identity JWT. Used locally for server-rendered page gating
    // (guards.ts) — apps/bff enforces the same check for the actual data
    // path, independently, against the same header on the forwarded request.
    TRUSTED_PROXY_JWT_HEADER: Schema.optionalWith(Schema.String, {
      default: () => 'X-Pomerium-Jwt-Assertion',
    }),
    // JWKS endpoint the proxy publishes its signing keys at. Fetched and
    // cached in-memory (see createTrustedProxyJwtVerifier); never a static key.
    TRUSTED_PROXY_JWKS_URL: Schema.String,
    // Expected `iss` claim on the Proxy Identity JWT.
    TRUSTED_PROXY_JWT_ISSUER: Schema.String,
    // Expected `aud` claim on the Proxy Identity JWT.
    TRUSTED_PROXY_JWT_AUDIENCE: Schema.String,
    // Comma-separated allow-list of signing algorithms accepted for the Proxy
    // Identity JWT — never inferred from the token itself. Pomerium signs
    // with ES256 by default.
    TRUSTED_PROXY_JWT_ALGORITHM: Schema.optionalWith(Schema.String, {
      default: () => 'ES256',
    }),
    // Dot-separated path to the identity email claim inside the verified
    // payload. Pomerium nests OIDC claims as arrays (`claims.email[0]`); this
    // resolves either a plain string or a single-element array at the path.
    TRUSTED_PROXY_JWT_EMAIL_CLAIM: Schema.optionalWith(Schema.String, {
      default: () => 'claims.email',
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
