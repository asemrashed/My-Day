import { auth } from "@/lib/auth-edge";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");

  if (isAuthPage) {
    if (isLoggedIn) {
      return Response.redirect(new URL("/", req.nextUrl));
    }
    return; // Proceed to auth page
  }

  if (!isLoggedIn) {
    let callbackUrl = pathname;
    if (req.nextUrl.search) {
      callbackUrl += req.nextUrl.search;
    }
    const encodedCallbackUrl = encodeURIComponent(callbackUrl);
    return Response.redirect(new URL(`/login?callbackUrl=${encodedCallbackUrl}`, req.nextUrl));
  }

  return; // Proceed to requested dashboard page
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api/auth (NextAuth endpoints)
     * - api/tasks, api/events, api/transactions, api/notifications (we can let API routes authorize internally via auth() helper)
     * - _next/static, _next/image (static Next.js assets)
     * - favicon.ico (favicon)
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
