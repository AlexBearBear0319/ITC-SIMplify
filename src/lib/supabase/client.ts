/** Factory for browser-side Supabase client instances. */

import { createBrowserClient } from '@supabase/ssr'

/**
 * Creates and returns a Supabase client for browser (client-side) use.
 *
 * Call this inside a React component or custom hook — not at the module level.
 * Each call creates a new client instance configured with the project credentials
 * stored in your .env.local file.
 */
export function createClient() {
  return createBrowserClient(
    // NEXT_PUBLIC_ prefix = safe to expose to the browser
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
