import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Define our destinations right at the top
  const errorTo = `${origin}/auth/login?error=invalid_or_expired_link`;
  const successTo = `${origin}/`;

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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          redirectResponse = NextResponse.redirect(successTo);
          cookiesToSet.forEach(({ name, value, options }) =>
            redirectResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // FIX: Next.js pre-fetching double-fires the route. Check if already logged in!
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Already logged in! Proceed to reset password.
      return NextResponse.redirect(successTo);
    }

    // Truly no user, link is invalid.
    return NextResponse.redirect(errorTo);
  }

  return redirectResponse;
}
