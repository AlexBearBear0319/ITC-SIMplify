/** Database helpers for active check-in/check-out sessions. */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActiveSession, DbResult } from '@/lib/types/database'


/**
 * The data we need from the student when they check in.
 */
export type CheckInData = {
  user_id: string          // the student's profile ID
  location_id: number      // which study spot they're at
  activity: string         // what they're doing, e.g. "Studying", "Group Work"
  module: string | null    // subject they're studying, e.g. "CS101" (can be null)
  duration_minutes: number // how long they plan to stay
  seats_taken?: number     // how many seats their group needs (defaults to 1)
}

/**
 * Creates a new session row when a student checks in.
 * This is basically the entry point for the whole check-in flow.
 *
 * After calling this you should also:
 *   - call awardPoints() from points.ts to give them their check-in points
 *   - the DB trigger handles updating location status automatically
 *
 * @param data - the check-in info (see CheckInData above)
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
      seats_taken: data.seats_taken ?? 1,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    console.error('[checkIn]', error.message)
    return { data: null, error: error.message }
  }

  return { data: session as ActiveSession, error: null }
}


/**
 * Ends a student's session by flipping is_active to false.
 * This is a soft delete, we keep the row for history/analytics.
 *
 * The DB trigger picks up the UPDATE and recalculates location status.
 *
 * @param sessionId - ID of the session to end
 */
export async function checkOut(
  supabase: SupabaseClient,
  sessionId: number,
): Promise<DbResult<ActiveSession>> {
  const { data, error } = await supabase
    .from('active_sessions')
    .update({ is_active: false })
    .eq('id', sessionId)
    .select()
    .single()

  if (error) {
    console.error(`[checkOut] sessionId=${sessionId}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: data as ActiveSession, error: null }
}


/**
 * Looks up the student's currently active session, if they have one.
 * Useful for checking "is this person already checked in somewhere" before
 * letting them check in again.
 *
 * Returns null data (not an error) if they're not checked in anywhere,
 * that's the normal case for users who just opened the app.
 *
 * @param userId - the student's profile ID
 */
export async function getUserActiveSession(
  supabase: SupabaseClient,
  userId: string,
): Promise<DbResult<ActiveSession | null>> {
  const { data, error } = await supabase
    .from('active_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error(`[getUserActiveSession] userId=${userId}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: data as ActiveSession | null, error: null }
}


/**
 * Gets all ongoing sessions at a specific study spot.
 * Used to figure out how many people are currently there and
 * to show the "Study Buddy" list on the location detail page.
 *
 * @param locationId - the location to check
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


/**
 * Adds up all the seats_taken from active sessions at a location.
 * One session can take multiple seats if the student brought a group.
 *
 * This is basically a reduce/sum operation, O(n) on the number of active sessions.
 *
 * @param locationId - the location to count seats for
 * @returns total seats currently occupied (a number), or an error
 */
export async function countSeatsTakenAtLocation(
  supabase: SupabaseClient,
  locationId: number,
): Promise<DbResult<number>> {
  const { data, error } = await getActiveSessionsAtLocation(supabase, locationId)

  if (error) return { data: null, error }

  const total = (data ?? []).reduce(
    (sum, session) => sum + (session.seats_taken ?? 1),
    0,
  )

  return { data: total, error: null }
}


/**
 * Updates fields on an existing active session.
 * For when the student wants to edit their check-in after the fact.
 *
 * Only updates sessions that are still active (safety check so we dont
 * accidentally edit old history rows).
 *
 * @param sessionId - ID of the session to update
 * @param updates   - only the fields that need changing (Partial type so you dont have to pass everything)
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
    .eq('is_active', true)   // only touch sessions that are still active
    .select()
    .single()

  if (error) {
    console.error(`[updateSession] sessionId=${sessionId}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: data as ActiveSession, error: null }
}


/**
 * Gets active sessions where the student is open to finding a study buddy.
 * Can optionally filter by module so you only see people studying the same thing.
 *
 * We use module != null as a proxy for "open to study buddy". If a student
 * didnt set a module, we treat their session as private. Could add an explicit
 * open_to_buddy boolean column later if we need more control.
 *
 * @param locationId      - the location to search
 * @param filterByModule  - optional, only return sessions with this module
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
    .not('module', 'is', null)

  if (filterByModule) {
    // case-insensitive match so "cs101" still finds "CS101"
    query = query.ilike('module', filterByModule)
  }

  const { data, error } = await query.order('check_in_time', { ascending: false })

  if (error) {
    console.error('[getStudyBuddySessionsAtLocation]', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as ActiveSession[], error: null }
}
