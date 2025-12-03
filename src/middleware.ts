import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that don't require authentication
const publicPaths = ["/login", "/register", "/admlogin"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("mobifaktura_session");

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    // If logged in, redirect away from login/register
    if (sessionCookie) {
      return NextResponse.redirect(new URL("/auth/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // API routes and static files are handled separately
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Protected paths require authentication
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
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
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
