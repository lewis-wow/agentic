import { Unauthorized } from '@repo/api/exceptions';
import type { AuthJwtClaims } from '@repo/auth';
import { JwtError, verifyRs256 } from '@repo/auth/jwt';
import { createMiddleware } from 'hono/factory';

type Options = {
  publicKeyPem: string;
};

export type ApiAuthVariables = {
  auth: AuthJwtClaims;
};

export const createJwtVerifyMiddleware = (options: Options) =>
  createMiddleware<{ Variables: ApiAuthVariables }>(async (c, next) => {
    const header = c.req.header('Authorization');
    const token = header?.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : undefined;

    if (!token) {
      return new Unauthorized().toResponse();
    }

    let claims: AuthJwtClaims;
    try {
      claims = verifyRs256<AuthJwtClaims>({
        token,
        publicKeyPem: options.publicKeyPem,
      });
    } catch (error) {
      if (error instanceof JwtError) {
        return new Unauthorized().toResponse();
      }
      throw error;
    }

    c.set('auth', claims);
    await next();
  });
