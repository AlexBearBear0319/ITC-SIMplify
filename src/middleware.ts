import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

/**
 * redirect — creates a redirect response and copies all session cookies from
 * the Supabase response onto it.
 *
 * This is the critical fix for the infinite-loop bug: when the session has
 * just been refreshed, the new tokens live in `sessionResponse`'s Set-Cookie
 * headers. If we return a bare NextResponse.redirect() without those cookies,
 * the browser never stores the new token → the very next request arrives
 * with stale/missing cookies → middleware sees a guest again → loop.
 */
function redirect(
  to: string,
  request: NextRequest,
  sessionResponse: NextResponse
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = to;
  const res = NextResponse.redirect(url);
  // Copy every refreshed session cookie onto the redirect response.
  sessionResponse.cookies.getAll().forEach(({ name, value }) =>
    res.cookies.set(name, value)
  );
  return res;
}

export async function middleware(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname.startsWith("/auth/");
  const isPublicLanding = pathname === "/" || pathname.startsWith("/landing");
  // These routes must never be intercepted — they complete auth flows mid-flight.
  const isPassThrough =
    pathname === "/auth/reset-password" ||
    pathname === "/auth/confirm" ||
    pathname === "/auth/reset-callback";

  // ── 1. Logged-in user visiting an auth page → send to dashboard ───────────
  if (isAuthPage && user && !isPassThrough) {
    return redirect("/dashboard", request, response);
  }

  // ── 2. Logged-in user on public landing → send to dashboard ───────────────
  if (user && isPublicLanding) {
    return redirect("/dashboard", request, response);
  }

  // ── 3. Guest visiting private pages → send to login ────────────────────────
  if (!isAuthPage && !isPublicLanding && !user) {
    return redirect("/auth/login", request, response);
  }

  // ── 4. Admin-only routes ───────────────────────────────────────────────────
  // Guests are already bounced above. Check is_admin for logged-in users.
  if (user && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return redirect("/dashboard", request, response);
    }
  }

  // Pass through — session cookies (including any refresh) are in `response`.
  return response;
}

// Run on every request except Next.js internals and static assets.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
