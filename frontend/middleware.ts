import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public routes that don't require authentication
const publicRoutes = ['/login', '/auth/signin', '/'];

// Check if JWT token is expired
function isTokenExpired(token: string): boolean {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    // Decode payload (base64)
    const payload = JSON.parse(atob(parts[1]));

    // Check expiration (exp is in seconds, Date.now() is in milliseconds)
    if (!payload.exp) return true;

    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  } catch (error) {
    console.error('Token validation error:', error);
    return true; // Treat invalid tokens as expired
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CRITICAL: Always allow Next.js internal paths and static assets
  // This must be FIRST before any other checks
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('/favicon.ico') ||
    pathname.includes('/public/') ||
    pathname === '/signup'
  ) {
    return NextResponse.next();
  }

  // Allow public routes
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Check for auth token in cookies (primary) or localStorage (via header)
  const tokenFromCookie = request.cookies.get('auth_token')?.value;
  const tokenFromHeader = request.headers.get('x-auth-token');
  const token = tokenFromCookie || tokenFromHeader;

  // If no token, redirect to login with return URL
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  // Check if token is expired
  if (isTokenExpired(token)) {
    // Expired token - redirect to login with return URL
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', pathname);

    // Clear the expired token cookie
    const response = NextResponse.redirect(url);
    response.cookies.delete('auth_token');

    return response;
  }

  // Token valid, allow request to proceed
  return NextResponse.next();
}

// Configure which routes use this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
