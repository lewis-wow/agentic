import type { AuthJwtClaims } from '@repo/auth';
import { JwtError, verifyRs256 } from '@repo/auth/jwt';
import { createMiddleware } from 'hono/factory';

type Options = {
  publicKeyPem: string;
};

export type ApiAuthVariables = {
  auth: AuthJwtClaims;
};

/**
 * Verifies the RS256 JWT minted by the BFF and injects the trusted claims into
 * the Hono context. `apps/api` has no auth DB dependency — it trusts the claims.
 * Missing / invalid / expired token → 401.
 */
export const createJwtVerifyMiddleware = (options: Options) =>
  createMiddleware<{ Variables: ApiAuthVariables }>(async (c, next) => {
    const header = c.req.header('Authorization');
    const token = header?.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : undefined;

    if (!token) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    let claims: AuthJwtClaims;
    try {
      claims = verifyRs256<AuthJwtClaims>({
        token,
        publicKeyPem: options.publicKeyPem,
      });
    } catch (error) {
      if (error instanceof JwtError) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      throw error;
    }

    c.set('auth', claims);
    await next();
  });
