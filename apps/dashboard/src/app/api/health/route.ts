/**
 * Unauthenticated liveness probe. Takes precedence over the `/api/[...path]`
 * catch-all (Next.js prefers the more specific literal route), so orchestrator
 * health checks hitting this container directly never need to carry Trusted
 * Proxy Authentication headers. Returns no flag/user data.
 */
export const GET = (): Response => Response.json({ status: 'ok' });
