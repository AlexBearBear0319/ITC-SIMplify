import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * Handles the token exchange for all email-based auth flows:
 *   - Password reset  (type=recovery)
 *   - Email verify    (type=signup / type=email)
 *
 * Supabase appends ?token_hash=...&type=...&next=... to the redirectTo URL
 * you supply. This route exchanges the hash for a real session, then
 * forwards the user to `next` (defaults to "/").
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "recovery" | "signup" | "email" | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      // Session is now stored in cookies — forward to the target page.
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Invalid or expired link → back to login with an error flag.
  return NextResponse.redirect(
    `${origin}/auth/login?error=invalid_or_expired_link`,
  );
}
