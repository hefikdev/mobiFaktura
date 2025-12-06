import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that don't require authentication
const publicPaths = ["/login", "/register", "/admlogin"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("mobifaktura_session");

  // Extract client IP address (simple priority: forwarded-for > real-ip > localhost)
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  
  const clientIp = forwardedFor?.split(",")[0]?.trim() || realIp || "127.0.0.1";

  // Clone the request headers and add/update the IP address header
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-real-ip", clientIp);

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    // If logged in, redirect away from login/register
    if (sessionCookie) {
      return NextResponse.redirect(new URL("/a/dashboard", request.url));
    }
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // API routes and static files are handled separately
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // Protected paths require authentication
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
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
