// ============================================================
// DB QUERIES: PROFILES (student accounts)
// ============================================================
// Functions for reading and writing student profile data.
// Each profile row is linked to a Supabase Auth user (same UUID as the primary key).
//
// Profiles are created automatically when a student signs up,
// either via a DB trigger or by calling createProfile() in the
// sign-up handler. Each student should only ever have one profile row.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DbResult, Profile } from '@/lib/types/database'

// ─── GET ONE PROFILE ──────────────────────────────────────────────────────────

/**
 * Gets a student's profile by their user ID.
 * Use this when you already have the UUID and just need the profile data.
 *
 * @param userId - the student's UUID (same one from supabase.auth.getUser())
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
 * Gets the profile of whoever is currently logged in.
 * Basically just wraps getUser() + getProfile() into one call so you
 * dont have to do it manually every time.
 *
 * Returns null data (not an error) if nobody is logged in.
 */
export async function getMyProfile(
  supabase: SupabaseClient,
): Promise<DbResult<Profile | null>> {
  // first get the auth user to find out who's logged in
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    // nobody logged in, thats fine, just return null
    return { data: null, error: null }
  }

  return getProfile(supabase, user.id)
}

// ─── CREATE PROFILE ───────────────────────────────────────────────────────────

/**
 * Creates a new profile row for a student right after they sign up.
 * Should be called in the sign-up handler right after auth.signUp() succeeds.
 *
 * Starts them at 0 points, level 1, and no streak (all the base case values).
 *
 * @param userId   - the new user's UUID from Supabase Auth
 * @param username - the username they picked during sign-up
 * @param fullName - their full name (optional)
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
      points: 0,       // everyone starts at 0
      level: 1,        // level 1 is the starting level
      streak_days: 0,  // no streak yet
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
 * Updates specific fields on a student's profile.
 * Uses Partial<Pick<...>> so you only pass in the fields you actually want to change,
 * the rest stay the same (partial update, not a full replace).
 *
 * Example:
 *   updateProfile(supabase, userId, { username: 'newname', avatar_url: 'https://...' })
 *
 * @param userId  - the student's UUID
 * @param updates - object with only the fields to update
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
 * Updates the student's check-in streak after they check in.
 *
 * Logic (basically three cases):
 *   - checked in yesterday -> increment streak by 1
 *   - checked in today already -> do nothing, already counted
 *   - checked in 2+ days ago -> streak resets back to 1
 *
 * We calculate daysDiff using timestamps (converted to ms, divided by ms per day).
 * This is similar to how you'd diff dates in any language.
 *
 * @param userId  - the student's UUID
 * @param profile - their current profile (we need last_checkin_at and streak_days)
 */
export async function updateStreak(
  supabase: SupabaseClient,
  userId: string,
  profile: Profile,
): Promise<DbResult<Profile>> {
  const now = new Date()
  const lastCheckin = profile.last_checkin_at ? new Date(profile.last_checkin_at) : null

  let newStreak = 1  // default is 1 (either fresh start or streak broke)

  if (lastCheckin) {
    const msPerDay = 1000 * 60 * 60 * 24
    const daysDiff = Math.floor((now.getTime() - lastCheckin.getTime()) / msPerDay)

    if (daysDiff === 0) {
      // already checked in today, dont change anything
      return { data: profile, error: null }
    } else if (daysDiff === 1) {
      // checked in yesterday, extend the streak
      newStreak = (profile.streak_days ?? 0) + 1
    }
    // if daysDiff >= 2 the streak is broken, newStreak stays at 1
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

// ─── DELETE PROFILE ───────────────────────────────────────────────────────────

/**
 * Deletes the student's profile row from the profiles table.
 * Called when they choose to delete their account from settings.
 *
 * After this you should also call supabase.auth.signOut() and redirect
 * them to the login page.
 *
 * @param userId - the student's UUID
 */
export async function deleteProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<DbResult<null>> {
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId)

  if (error) {
    console.error(`[deleteProfile] userId=${userId}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: null, error: null }
}

// ─── GET LEADERBOARD ──────────────────────────────────────────────────────────

/**
 * Grabs the top students sorted by points, highest first.
 * Used to populate the leaderboard/rankings page.
 *
 * Only selects the columns we actually need on the leaderboard,
 * dont need to send the whole profile row over the wire.
 *
 * @param limit - how many students to return (default 10)
 */
export async function getLeaderboard(
  supabase: SupabaseClient,
  limit: number = 10,
): Promise<DbResult<Profile[]>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, points, level, streak_days')
    .order('points', { ascending: false })  // highest points first
    .limit(limit)

  if (error) {
    console.error('[getLeaderboard]', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as Profile[], error: null }
}
