import { NextResponse, type NextRequest } from 'next/server';
import { REQUEST_ID_HEADER, resolveRequestId } from '@/lib/request-id';

/**
 * Applies platform-wide security headers and request-ID propagation to
 * every response — see docs/07-security/api-security.md, "Security
 * headers", and docs/10-devops/logging.md, "Correlation".
 *
 * Session/auth handling (resolving the current Supabase session) is
 * deliberately NOT implemented here yet — full authentication middleware
 * is Sprint 1 (Identity & Organizations) scope, once there is a session to
 * resolve and Memberships to check. See docs/13-roadmap/sprint-1.md.
 */
export function middleware(request: NextRequest): NextResponse {
  const requestId = resolveRequestId(request.headers);
  const response = NextResponse.next();

  response.headers.set(REQUEST_ID_HEADER, requestId);
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: [
    /*
     * Match every request path except static assets and Next.js internals,
     * consistent with the standard Next.js middleware matcher pattern.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
