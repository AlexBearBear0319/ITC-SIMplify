import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Dedicated PKCE callback for the password-reset flow.
 * Using a separate path (instead of a ?next= query param) makes this
 * resilient to Supabase stripping query params from the redirectTo URL.
 *
 * Supabase redirects here with ?code=xxx after the user clicks the email link.
 * We exchange the code for a session, attach the cookies to the redirect
 * response, then send the user to /auth/reset-password.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const errorTo   = `${origin}/auth/login?error=invalid_or_expired_link`;
  const successTo = `${origin}/auth/reset-password`;

  if (!code) return NextResponse.redirect(errorTo);

  let redirectResponse = NextResponse.redirect(successTo);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          redirectResponse = NextResponse.redirect(successTo);
          cookiesToSet.forEach(({ name, value, options }) =>
            redirectResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(errorTo);

  return redirectResponse;
}
