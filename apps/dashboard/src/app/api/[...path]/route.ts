import { forwardRequest } from '@repo/bff';

import { env } from '../../../env';

/**
 * Pure forward to apps/bff — no authentication happens here. The original
 * request (including whatever Trusted Proxy Authentication headers the
 * operator's reverse proxy set) is forwarded as-is; apps/bff validates them,
 * mints the RS256 JWT, and forwards on to apps/api.
 */
const handler = async (
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> => {
  const { path } = await params;

  const apiPath = '/' + path.join('/');
  const query = new URL(request.url).search;
  const method = request.method;
  const body =
    method === 'GET' || method === 'HEAD'
      ? undefined
      : await request.arrayBuffer();

  const proxyRequest = new Request(
    new URL(apiPath + query, 'http://placeholder').toString(),
    { method, headers: request.headers, body },
  );

  return forwardRequest(proxyRequest, env.BFF_URL);
};

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
