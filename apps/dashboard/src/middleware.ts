import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/setup', '/api/auth'];

const isPublic = (pathname: string): boolean =>
  PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export const middleware = (request: NextRequest): NextResponse => {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const sessionToken =
    request.cookies.get('better-auth.session_token') ??
    request.cookies.get('__Secure-better-auth.session_token');

  if (!sessionToken) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
};

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
