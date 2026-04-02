/** Factory for server-side Supabase client instances backed by request cookies. */

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
