// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_ROUTES = ['/'];
const PUBLIC_ROUTES = ['/login', '/register'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('__session')?.value;

  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));

  if (!sessionCookie && isProtectedRoute) {
    // Redirect to login if trying to access a protected route without a session
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (sessionCookie && isPublicRoute) {
    // If user is logged in, redirect from public routes (like login) to the home page
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
