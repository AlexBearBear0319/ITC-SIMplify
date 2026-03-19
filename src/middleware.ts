// ============================================================
// NEXT.JS MIDDLEWARE — Automatic Session Refresh
// ============================================================
// This file runs automatically on every page request BEFORE the page loads.
// Its main job: silently refresh the user's Supabase auth session so they
// stay logged in without being asked to log in again every hour.
//
// Think of it like a background "keep me logged in" mechanism.
//
// HOW AUTH PROTECTION WORKS (add this when the login page is ready):
//   Uncomment the "AUTH GUARD" block below to redirect unauthenticated
//   users to /login before they can see any protected page.
//
// IMPORTANT: Do NOT move or rename this file. Next.js specifically looks
//            for 'middleware.ts' at the root of the src/ folder.
// ============================================================

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Start with a default "let the request through" response
  let supabaseResponse = NextResponse.next({ request })

  // Create a Supabase client that can read and write cookies mid-request.
  // This is different from the server client — it patches cookies on both
  // the incoming request AND outgoing response simultaneously.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read all cookies from the incoming request
        getAll() {
          return request.cookies.getAll()
        },
        // Write refreshed session cookies to both the request and response
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            // Next.js 16 RequestCookies.set() only accepts (name, value)
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    },
  )

  // IMPORTANT: This line refreshes the session if it has expired.
  // Do NOT add any code between createServerClient and supabase.auth.getUser() —
  // it can silently break authentication in hard-to-debug ways.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── AUTH GUARD ────────────────────────────────────────────────────────────
  // Uncomment this block when the /login and /auth pages are built.
  // It redirects any unauthenticated visitor to the login page.
  //
  // const isPublicRoute =
  //   request.nextUrl.pathname.startsWith('/login') ||
  //   request.nextUrl.pathname.startsWith('/auth')
  //
  // if (!user && !isPublicRoute) {
  //   const url = request.nextUrl.clone()
  //   url.pathname = '/login'
  //   return NextResponse.redirect(url)
  // }
  // ─────────────────────────────────────────────────────────────────────────

  // Suppress unused-variable warning until the auth guard is enabled
  void user

  return supabaseResponse
}

// Tell Next.js which routes this middleware should run on.
// It skips static files, images, and favicons for performance.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
