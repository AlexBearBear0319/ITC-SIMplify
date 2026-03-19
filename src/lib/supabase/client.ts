// ============================================================
// SUPABASE BROWSER CLIENT
// ============================================================
// Use this file in components that have "use client" at the top.
// It creates a Supabase connection that runs in the user's browser
// and automatically reads their login session from cookies.
//
// HOW TO USE (inside a React client component or hook):
//
//   'use client'
//   import { createClient } from '@/lib/supabase/client'
//
//   const supabase = createClient()
//   const { data } = await supabase.from('locations').select('*')
//
// NOTE: Do NOT use this in Server Components or API routes.
//       Use '@/lib/supabase/server' instead for those.
// ============================================================

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
