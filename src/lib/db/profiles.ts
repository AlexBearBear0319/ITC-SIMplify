// ============================================================
// DATABASE QUERIES: PROFILES (Student Accounts)
// ============================================================
// Functions for reading and updating student profile data.
// Each profile is tied to a Supabase Auth user (same UUID).
//
// IMPORTANT: A profile is automatically created when a student signs up.
//            You can set this up with a Supabase database trigger or by
//            calling createProfile() in your sign-up handler.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DbResult, Profile } from '@/lib/types/database'

// ─── GET ONE PROFILE ──────────────────────────────────────────────────────────

/**
 * Fetches a student's profile by their user ID.
 * Use this to display their name, points, level, streak etc.
 *
 * @param userId - The student's UUID (from supabase.auth.getUser())
 */
export async function getProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<DbResult<Profile>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error(`[getProfile] userId=${userId}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: data as Profile, error: null }
}

// ─── GET LOGGED-IN USER'S OWN PROFILE ────────────────────────────────────────

/**
 * Fetches the profile of the currently logged-in student.
 * Combines getUser() and getProfile() into one convenient call.
 *
 * Returns null data (not an error) if no one is logged in.
 */
export async function getMyProfile(
  supabase: SupabaseClient,
): Promise<DbResult<Profile | null>> {
  // First, get the authenticated user from Supabase Auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    // No one is logged in — return null without treating it as an error
    return { data: null, error: null }
  }

  return getProfile(supabase, user.id)
}

// ─── CREATE PROFILE ───────────────────────────────────────────────────────────

/**
 * Creates a new profile row for a student after they sign up.
 * Call this in your sign-up route/action right after auth.signUp().
 *
 * @param userId   - The new user's UUID from Supabase Auth
 * @param username - The username they chose during sign-up
 * @param fullName - Their full name (optional)
 */
export async function createProfile(
  supabase: SupabaseClient,
  userId: string,
  username: string,
  fullName?: string,
): Promise<DbResult<Profile>> {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      username,
      full_name: fullName ?? null,
      points: 0,       // Start with 0 points
      level: 1,        // Start at level 1
      streak_days: 0,  // No streak yet
    })
    .select()
    .single()

  if (error) {
    console.error('[createProfile]', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as Profile, error: null }
}

// ─── UPDATE PROFILE ───────────────────────────────────────────────────────────

/**
 * Updates a student's profile with the given fields.
 * Only provide the fields you want to change — others stay as they are.
 *
 * Example:
 *   updateProfile(supabase, userId, { username: 'newname', avatar_url: 'https://...' })
 *
 * @param userId  - The student's UUID
 * @param updates - An object with only the fields to update
 */
export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  updates: Partial<Pick<Profile, 'username' | 'full_name' | 'avatar_url'>>,
): Promise<DbResult<Profile>> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    console.error(`[updateProfile] userId=${userId}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: data as Profile, error: null }
}

// ─── UPDATE STREAK ────────────────────────────────────────────────────────────

/**
 * Updates a student's check-in streak.
 * Call this after a successful check-in.
 *
 * Logic:
 *   - If last check-in was yesterday → increment streak by 1
 *   - If last check-in was today → do nothing (already counted)
 *   - If last check-in was 2+ days ago → reset streak to 1
 *
 * @param userId  - The student's UUID
 * @param profile - Their current profile (to read last_checkin_at and streak_days)
 */
export async function updateStreak(
  supabase: SupabaseClient,
  userId: string,
  profile: Profile,
): Promise<DbResult<Profile>> {
  const now = new Date()
  const lastCheckin = profile.last_checkin_at ? new Date(profile.last_checkin_at) : null

  let newStreak = 1  // Default to 1 (starting or resetting a streak)

  if (lastCheckin) {
    // Calculate how many calendar days since last check-in
    const msPerDay = 1000 * 60 * 60 * 24
    const daysDiff = Math.floor((now.getTime() - lastCheckin.getTime()) / msPerDay)

    if (daysDiff === 0) {
      // Already checked in today — keep streak as-is, don't update
      return { data: profile, error: null }
    } else if (daysDiff === 1) {
      // Checked in yesterday — extend the streak
      newStreak = (profile.streak_days ?? 0) + 1
    }
    // If daysDiff >= 2, streak resets to 1 (default above)
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      streak_days: newStreak,
      last_checkin_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    console.error(`[updateStreak] userId=${userId}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: data as Profile, error: null }
}

// ─── GET LEADERBOARD ──────────────────────────────────────────────────────────

/**
 * Fetches the top students ranked by points.
 * Use this to power the leaderboard / rankings page.
 *
 * @param limit - How many students to return (default: 10)
 */
export async function getLeaderboard(
  supabase: SupabaseClient,
  limit: number = 10,
): Promise<DbResult<Profile[]>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, points, level, streak_days')
    .order('points', { ascending: false })  // Highest points first
    .limit(limit)

  if (error) {
    console.error('[getLeaderboard]', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as Profile[], error: null }
}
