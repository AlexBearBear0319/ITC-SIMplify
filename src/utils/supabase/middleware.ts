import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * updateSession
 *
 * The official @supabase/ssr pattern for Next.js App Router middleware.
 *
 * Why this exists as a separate utility:
 *   The supabaseResponse object tracks any Set-Cookie headers that Supabase
 *   needs to issue (e.g. token refresh). If we return a plain
 *   NextResponse.redirect() without copying those cookies, the browser never
 *   stores the refreshed token → every subsequent request looks like a guest
 *   → infinite redirect loop.
 *
 *   This function returns BOTH the base response (with cookies already synced)
 *   AND the authenticated user so that middleware.ts can make routing
 *   decisions and then copy cookies onto any redirect it issues.
 */
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse;
  user: User | null;
  supabase: SupabaseClient;
}> {
  // Start with a pass-through response. Supabase will mutate this via setAll
  // when it needs to issue a token refresh.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Step 1 — mirror the new values back onto the incoming request so
          //           any subsequent reads within this middleware invocation
          //           see the refreshed tokens.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Step 2 — rebuild the outgoing response so the Set-Cookie headers
          //           are forwarded to the browser.
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do NOT add any logic between createServerClient and getUser().
  // getUser() both validates the token and triggers the refresh cycle above.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response: supabaseResponse, user, supabase };
}
