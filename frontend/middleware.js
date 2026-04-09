import { NextResponse } from "next/server";

/**
 * Signal CRM — Next.js Middleware
 *
 * Runs on every request BEFORE page rendering (Edge Runtime).
 * Responsibilities:
 *   1. Auth guard — redirect unauthenticated users away from /dashboard
 *   2. Auth redirect — send already-logged-in users away from /login
 *   3. Security headers (backup to next.config.js headers)
 *   4. Bot protection — block known bad bots
 *
 * Auth strategy: We check the `sig_auth` cookie which is set by lib/api.js
 * alongside localStorage (for middleware compatibility — localStorage is
 * only available client-side, cookies work server-side too).
 */

// ── Routes that require authentication ────────────────────────────────────────
const PROTECTED_PREFIXES = ["/dashboard"];

// ── Routes that logged-in users should not visit ──────────────────────────────
const AUTH_PAGES = ["/login"];

// ── Known bad bots to reject ──────────────────────────────────────────────────
const BAD_BOTS = [
  "AhrefsBot", "MJ12bot", "DotBot", "BLEXBot", "SemrushBot",
  "DataForSeoBot", "serpstatbot", "PetalBot", "ZoominfoBot",
];

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const userAgent    = request.headers.get("user-agent") || "";

  // ── 1. Block bad bots ──────────────────────────────────────────────────────
  const isBadBot = BAD_BOTS.some((bot) =>
    userAgent.toLowerCase().includes(bot.toLowerCase())
  );
  if (isBadBot) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // ── 2. Auth guard ──────────────────────────────────────────────────────────
  const authCookie = request.cookies.get("sig_auth")?.value;
  const isLoggedIn = authCookie === "1";

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthPage  = AUTH_PAGES.some((p) => pathname.startsWith(p));

  if (isProtected && !isLoggedIn) {
    // Not logged in → redirect to login with return URL
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && isLoggedIn) {
    // Already logged in → redirect to dashboard
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // ── 3. Pass through with security headers ─────────────────────────────────
  const response = NextResponse.next();

  // Request ID for tracing (matches backend X-Request-ID pattern)
  const requestId = crypto.randomUUID();
  response.headers.set("X-Request-ID", requestId);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static   (static files)
     * - _next/image    (image optimisation)
     * - favicon.ico    (favicon)
     * - public files   (png, jpg, svg, etc.)
     * - manifest/robots/sitemap
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|otf|mp4|pdf|webmanifest)$).*)",
  ],
};
