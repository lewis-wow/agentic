import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Routes that never require an authenticated session.
const PUBLIC_PATHS = ['/login', '/register', '/setup', '/api/auth'];

const isPublic = (pathname: string): boolean =>
  PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * Edge-compatible middleware: cookie-presence check only.
 *
 * First-boot detection (User.count() === 0 → /setup) and full session
 * validation both require Prisma, which can't run on the Edge runtime, so they
 * happen at the route level instead:
 * - the /login, /register and /setup pages redirect to /setup on an empty DB,
 * - the dashboard root layout validates the session via getSession().
 */
export const middleware = (request: NextRequest): NextResponse => {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const sessionToken =
    request.cookies.get('better-auth.session_token') ??
    request.cookies.get('__Secure-better-auth.session_token');

  if (!sessionToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
};

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
