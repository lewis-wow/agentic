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
    // Name of the header the reverse proxy sets with the signed Proxy Identity
    // JWT. Configurable because each JWT-capable proxy defaults differently
    // (Pomerium: X-Pomerium-Jwt-Assertion, GCP IAP: X-Goog-IAP-JWT-Assertion, ...).
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
    // Base URL of apps/api that authenticated requests are proxied to.
    API_URL: Schema.optionalWith(Schema.String, {
      default: () => 'http://localhost:3001',
    }),
  },
  runtimeEnv: process.env as Record<string, string | undefined>,
});
