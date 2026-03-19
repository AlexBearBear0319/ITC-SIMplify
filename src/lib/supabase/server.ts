// ============================================================
// SUPABASE SERVER CLIENT
// ============================================================
// Use this file in:
//   - Server Components (files without 'use client')
//   - API Route Handlers (app/api/*/route.ts)
//   - Server Actions (functions marked with 'use server')
//
// It reads the logged-in user's session from the HTTP request cookies
// on the server side — the user never sees this code run.
//
// HOW TO USE (inside a Server Component):
//
//   import { createClient } from '@/lib/supabase/server'
//
//   const supabase = await createClient()   // ← must await!
//   const { data } = await supabase.from('locations').select('*')
//
// NOTE: Always use "await" when calling createClient() here.
//       The function is async because it needs to read from the cookie store.
// ============================================================

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Creates and returns a Supabase client for server-side use.
 *
 * This function MUST be awaited. It reads the current user's auth session
 * from the request cookies so Supabase knows who is making the request.
 */
export async function createClient() {
  // Next.js 15+ requires awaiting the cookies() function
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Tell Supabase how to READ cookies from the incoming request
        getAll() {
          return cookieStore.getAll()
        },

        // Tell Supabase how to WRITE cookies to the outgoing response
        // (used to refresh the auth session token)
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // This will throw in Server Components because their cookies are read-only.
            // It is safe to ignore — the middleware handles session refresh instead.
          }
        },
      },
    },
  )
}
