import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the Service Role key.
 * This bypasses RLS entirely — ONLY use inside Server Actions
 * after verifying the caller is an admin.
 * NEVER import this in client components or expose to the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
