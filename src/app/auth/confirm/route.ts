import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Token-exchange endpoint for all Supabase email flows.
 *
 * PKCE flow (default for @supabase/ssr) — ?code=...
 * Email OTP flow                        — ?token_hash=...&type=...
 *
 * Why we use createServerClient directly (not createClient from server.ts):
 *   server.ts sets cookies via next/headers cookies(), but those mutations are
 *   NOT automatically forwarded when the handler returns a NextResponse.redirect().
 *   We manually attach session cookies to the redirect response instead —
 *   the same pattern the middleware uses.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code       = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type       = searchParams.get("type") as "recovery" | "signup" | "email" | null;
  const next       = searchParams.get("next") ?? "/";

  const redirectTo = `${origin}${next}`;
  const errorTo    = `${origin}/auth/login?error=invalid_or_expired_link`;

  // Start with an optimistic success redirect. The setAll callback will
  // re-create it with session cookies baked in once the exchange succeeds.
  let redirectResponse = NextResponse.redirect(redirectTo);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Mirror onto the request for any subsequent supabase calls.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Re-build the redirect response so the browser receives the tokens.
          redirectResponse = NextResponse.redirect(redirectTo);
          cookiesToSet.forEach(({ name, value, options }) =>
            redirectResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  if (code) {
    // PKCE flow
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(errorTo);
  } else if (token_hash && type) {
    // Email OTP / token_hash flow
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (error) return NextResponse.redirect(errorTo);
  } else {
    return NextResponse.redirect(errorTo);
  }

  // redirectResponse now carries the Set-Cookie headers for the new session.
  return redirectResponse;
}
