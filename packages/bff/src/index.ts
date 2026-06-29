import type { Session, User } from '@repo/prisma';

export { SESSION_COOKIE } from './consts.js';

export type SessionWithUser = Session & { user: User };

type SessionLookup = (token: string) => Promise<SessionWithUser | null>;

/**
 * better-auth stores the cookie as `<token>.<signature>`. The DB row keys on
 * the raw token, so strip the signature before lookup.
 */
export const extractSessionToken = (rawCookie: string): string => {
  const decoded = decodeURIComponent(rawCookie);
  const dot = decoded.indexOf('.');
  return dot === -1 ? decoded : decoded.slice(0, dot);
};

/**
 * Validates the session cookie against the DB. Returns the associated user or
 * null if the cookie is absent, unknown, or expired.
 */
export const resolveSessionUser = async (
  rawCookie: string | undefined,
  findSession: SessionLookup,
): Promise<User | null> => {
  if (!rawCookie) return null;

  const token = extractSessionToken(rawCookie);
  if (!token) return null;

  const session = await findSession(token);
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) return null;

  return session.user;
};

/**
 * Injects `Authorization: Bearer <jwt>`, rewrites the URL origin to
 * `apiBaseUrl` (preserving path and query string), and returns the proxied
 * response.
 */
export const forwardWithJwt = async (
  request: Request,
  jwt: string,
  apiBaseUrl: string,
): Promise<Response> => {
  const { pathname, search } = new URL(request.url);
  const target = new URL(pathname + search, apiBaseUrl);

  const headers = new Headers(request.headers);
  headers.set('Authorization', `Bearer ${jwt}`);

  const method = request.method;
  const body =
    method === 'GET' || method === 'HEAD'
      ? undefined
      : await request.arrayBuffer();

  const upstream = await fetch(target.toString(), { method, headers, body });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });
};
