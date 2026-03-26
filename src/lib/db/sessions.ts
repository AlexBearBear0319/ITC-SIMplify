// ============================================================
// DATABASE QUERIES: ACTIVE SESSIONS (Check-in / Check-out)
// ============================================================
// Handles the core feature: students checking in/out of study spots.
//
// FLOW:
//   1. Student scans QR code at a location
//   2. App calls checkIn() → creates a session record
//   3. Student is now "occupying" the spot
//   4. App calls awardCheckInPoints() → student earns points
//   5. App calls recalculateLocationStatus() → spot status updates
//   6. When done, student calls checkOut() → session ends
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActiveSession, DbResult } from '@/lib/types/database'

// ─── CHECK IN ─────────────────────────────────────────────────────────────────

/**
 * Data needed when a student checks in to a study spot.
 */
export type CheckInData = {
  user_id: string          // The student's profile ID
  location_id: number      // Which study spot they're at
  activity: string         // What they're doing, e.g., "Studying", "Group Work"
  module: string | null    // Subject/module they're studying, e.g., "CS101" (optional)
  duration_minutes: number // How long they plan to stay
  seats_taken?: number     // How many seats their group takes (defaults to 1)
}

/**
 * Creates a new active session when a student checks in to a study spot.
 * This is the main entry point for the check-in feature.
 *
 * After calling this, you should also:
 *   - Call awardPoints() from '@/lib/db/points' to give them check-in points
 *   - Call recalculateLocationStatus() from '@/lib/db/locations' to update the map
 *
 * @param data - The check-in details (see CheckInData type)
 */
export async function checkIn(
  supabase: SupabaseClient,
  data: CheckInData,
): Promise<DbResult<ActiveSession>> {
  const { data: session, error } = await supabase
    .from('active_sessions')
    .insert({
      user_id: data.user_id,
      location_id: data.location_id,
      activity: data.activity,
      module: data.module,
      duration_minutes: data.duration_minutes,
      seats_taken: data.seats_taken ?? 1,  // Default to 1 seat if not specified
      is_active: true,
    })
    .select()    // Return the newly created row
    .single()

  if (error) {
    console.error('[checkIn]', error.message)
    return { data: null, error: error.message }
  }

  return { data: session as ActiveSession, error: null }
}

// ─── CHECK OUT ────────────────────────────────────────────────────────────────

/**
 * Ends a student's session at a study spot by marking it as inactive.
 * Call this when the student taps "Check Out" in the app.
 *
 * After calling this, you should also:
 *   - Call recalculateLocationStatus() from '@/lib/db/locations'
 *
 * @param sessionId - The ID of the active session to end
 */
export async function checkOut(
  supabase: SupabaseClient,
  sessionId: number,
): Promise<DbResult<ActiveSession>> {
  const { data, error } = await supabase
    .from('active_sessions')
    .update({ is_active: false })  // Mark as inactive (soft delete — keeps history)
    .eq('id', sessionId)
    .select()
    .single()

  if (error) {
    console.error(`[checkOut] sessionId=${sessionId}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: data as ActiveSession, error: null }
}

// ─── GET USER'S CURRENT SESSION ───────────────────────────────────────────────

/**
 * Finds the student's currently active session (if any).
 * Use this to check if a user is already checked in somewhere before
 * allowing them to check in at a new location.
 *
 * Returns null data (not an error) if the user isn't checked in anywhere.
 *
 * @param userId - The student's profile ID
 */
export async function getUserActiveSession(
  supabase: SupabaseClient,
  userId: string,
): Promise<DbResult<ActiveSession | null>> {
  const { data, error } = await supabase
    .from('active_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)   // Only look at sessions that haven't ended yet
    .maybeSingle()           // Returns null instead of error if no row found

  if (error) {
    console.error(`[getUserActiveSession] userId=${userId}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: data as ActiveSession | null, error: null }
}

// ─── GET ALL ACTIVE SESSIONS AT A LOCATION ───────────────────────────────────

/**
 * Fetches all ongoing sessions at a specific study spot.
 * Used to calculate how many people are currently there and
 * to show the "Study Buddy" list of people at the location.
 *
 * @param locationId - The location to check
 */
export async function getActiveSessionsAtLocation(
  supabase: SupabaseClient,
  locationId: number,
): Promise<DbResult<ActiveSession[]>> {
  const { data, error } = await supabase
    .from('active_sessions')
    .select('*')
    .eq('location_id', locationId)
    .eq('is_active', true)
    .order('check_in_time', { ascending: false })

  if (error) {
    console.error(`[getActiveSessionsAtLocation] locationId=${locationId}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: data as ActiveSession[], error: null }
}

// ─── COUNT SEATS TAKEN AT A LOCATION ─────────────────────────────────────────

/**
 * Counts the total number of seats currently occupied at a location.
 * Each session can take more than 1 seat if the student brought a group.
 *
 * @param locationId - The location to count seats for
 * @returns The total seats taken (a number), or an error
 */
export async function countSeatsTakenAtLocation(
  supabase: SupabaseClient,
  locationId: number,
): Promise<DbResult<number>> {
  const { data, error } = await getActiveSessionsAtLocation(supabase, locationId)

  if (error) return { data: null, error }

  // Add up the seats_taken from each active session
  const total = (data ?? []).reduce(
    (sum, session) => sum + (session.seats_taken ?? 1),
    0,
  )

  return { data: total, error: null }
}

// ─── UPDATE SESSION ───────────────────────────────────────────────────────────

/**
 * Updates an existing active session's details.
 * Call this when the student wants to edit their session after checking in.
 *
 * @param sessionId - The ID of the session to update
 * @param updates   - Fields to change: activity, module, duration_minutes, seats_taken
 */
export async function updateSession(
  supabase: SupabaseClient,
  sessionId: number,
  updates: Partial<Pick<ActiveSession, 'activity' | 'module' | 'duration_minutes' | 'seats_taken'>>,
): Promise<DbResult<ActiveSession>> {
  const { data, error } = await supabase
    .from('active_sessions')
    .update(updates)
    .eq('id', sessionId)
    .eq('is_active', true)   // Safety: only update sessions that are still active
    .select()
    .single()

  if (error) {
    console.error(`[updateSession] sessionId=${sessionId}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: data as ActiveSession, error: null }
}

// ─── GET SESSIONS OPEN TO STUDY BUDDY ────────────────────────────────────────

/**
 * Fetches active sessions where the student has opted in to finding a study buddy.
 * Can optionally filter by module so students can find people studying
 * the same subject.
 *
 * Note: "Open to study buddy" is determined by the student's session having
 * a module set. Students who leave module as null are treating their session
 * as private. Add an explicit `open_to_buddy` boolean column to active_sessions
 * in Supabase if you need more control over this.
 *
 * @param locationId      - The location to search at
 * @param filterByModule  - Optional: only return sessions studying this module
 */
export async function getStudyBuddySessionsAtLocation(
  supabase: SupabaseClient,
  locationId: number,
  filterByModule?: string,
): Promise<DbResult<ActiveSession[]>> {
  let query = supabase
    .from('active_sessions')
    .select('*')
    .eq('location_id', locationId)
    .eq('is_active', true)
    .not('module', 'is', null)  // Only sessions with a module are "open to study buddy"

  if (filterByModule) {
    // Case-insensitive module match — e.g., "cs101" matches "CS101"
    query = query.ilike('module', filterByModule)
  }

  const { data, error } = await query.order('check_in_time', { ascending: false })

  if (error) {
    console.error('[getStudyBuddySessionsAtLocation]', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as ActiveSession[], error: null }
}
