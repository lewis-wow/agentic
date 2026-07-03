export {
  resolveTrustedProxyUser,
  type ResolveTrustedProxyUserArgs,
} from './trustedProxy.js';

const proxyRequest = async (
  request: Request,
  apiBaseUrl: string,
  mutateHeaders?: (headers: Headers) => void,
): Promise<Response> => {
  const { pathname, search } = new URL(request.url);
  const target = new URL(pathname + search, apiBaseUrl);

  const headers = new Headers(request.headers);
  mutateHeaders?.(headers);

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

/**
 * Injects `Authorization: Bearer <jwt>`, rewrites the URL origin to
 * `apiBaseUrl` (preserving path and query string), and returns the proxied
 * response.
 */
export const forwardWithJwt = (
  request: Request,
  jwt: string,
  apiBaseUrl: string,
): Promise<Response> =>
  proxyRequest(request, apiBaseUrl, (headers) => {
    headers.set('Authorization', `Bearer ${jwt}`);
  });

/**
 * Forwards a request unchanged (all original headers preserved, no
 * Authorization injected) to `apiBaseUrl`. Used by apps/dashboard's
 * catch-all route, which does no authentication of its own — apps/bff
 * validates the Trusted Proxy Authentication headers already present on the
 * original request and mints the JWT itself.
 */
export const forwardRequest = (
  request: Request,
  apiBaseUrl: string,
): Promise<Response> => proxyRequest(request, apiBaseUrl);
