// ============================================================
// DATABASE QUERIES: LOCATIONS (Study Spots)
// ============================================================
// All functions for reading and updating study spot data.
//
// HOW TO USE in a Server Component (no 'use client'):
//   import { createClient } from '@/lib/supabase/server'
//   import { getAllLocations } from '@/lib/db/locations'
//
//   const supabase = await createClient()
//   const { data, error } = await getAllLocations(supabase)
//
// HOW TO USE in a Client Component ('use client' at top):
//   import { createClient } from '@/lib/supabase/client'
//   import { getAllLocations } from '@/lib/db/locations'
//
//   const supabase = createClient()
//   const { data, error } = await getAllLocations(supabase)
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DbResult, Location, LocationStatus } from '@/lib/types/database'

// ─── FILTER OPTIONS ──────────────────────────────────────────────────────────

/**
 * Options you can pass to getLocationsWithFilters() to narrow down results.
 * All fields are optional — only the ones you provide will be applied.
 */
export type LocationFilters = {
  category?: string          // e.g., "Library", "Cafe", "Outdoor"
  hasPowerOutlets?: boolean  // true = only show spots with at least 1 charging port
  status?: LocationStatus    // e.g., only show 'empty' spots
}

// ─── GET ALL LOCATIONS ────────────────────────────────────────────────────────

/**
 * Fetches every study spot from the database, sorted alphabetically by name.
 * Use this to populate the map or a full list of spots.
 */
export async function getAllLocations(
  supabase: SupabaseClient,
): Promise<DbResult<Location[]>> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('[getAllLocations]', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as Location[], error: null }
}

// ─── GET ONE LOCATION BY ID ───────────────────────────────────────────────────

/**
 * Fetches a single study spot by its numeric ID.
 * Use this on the location detail / info page.
 *
 * @param id - The location's ID number (from the database)
 */
export async function getLocationById(
  supabase: SupabaseClient,
  id: number,
): Promise<DbResult<Location>> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('id', id)   // .eq = "where id equals ..."
    .single()       // .single() returns one object instead of an array

  if (error) {
    console.error(`[getLocationById] id=${id}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: data as Location, error: null }
}

// ─── GET LOCATION BY QR TOKEN ─────────────────────────────────────────────────

/**
 * Finds a study spot using the UUID stored in its QR code.
 * Called when a student scans the QR code posted at a location.
 *
 * @param token - The UUID string encoded in the QR code
 */
export async function getLocationByQRToken(
  supabase: SupabaseClient,
  token: string,
): Promise<DbResult<Location>> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('qr_token', token)
    .single()

  if (error) {
    console.error('[getLocationByQRToken]', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as Location, error: null }
}

// ─── GET LOCATIONS WITH FILTERS ───────────────────────────────────────────────

/**
 * Fetches study spots that match the given search filters.
 * Used for the "Search & Filter" feature — students can narrow down spots
 * by category, availability of power outlets, or current occupancy.
 *
 * Example usage:
 *   getLocationsWithFilters(supabase, { hasPowerOutlets: true, status: 'empty' })
 *
 * @param filters - An object with optional filter criteria (see LocationFilters type)
 */
export async function getLocationsWithFilters(
  supabase: SupabaseClient,
  filters: LocationFilters,
): Promise<DbResult<Location[]>> {
  // Start building the query — we'll chain filter conditions onto it
  let query = supabase.from('locations').select('*')

  // Only apply each filter if the caller actually provided a value for it
  if (filters.category) {
    query = query.eq('category', filters.category)
  }

  if (filters.hasPowerOutlets === true) {
    // .gt means "greater than" — this finds spots with at least 1 power outlet
    query = query.gt('power_outlets', 0)
  }

  if (filters.status) {
    query = query.eq('current_status', filters.status)
  }

  const { data, error } = await query.order('name', { ascending: true })

  if (error) {
    console.error('[getLocationsWithFilters]', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as Location[], error: null }
}

// ─── UPDATE LOCATION STATUS ───────────────────────────────────────────────────

/**
 * Updates the occupancy status of a study spot.
 * This is called automatically when students check in or out,
 * and can also be used by admins to manually mark a spot as 'closed'.
 *
 * The status is recalculated based on how full the spot is:
 *   0% full      → 'empty'
 *   1–60% full   → 'moderate'
 *   61–100% full → 'busy'
 *   Manually set → 'closed'
 *
 * @param id     - The location to update
 * @param status - The new status: 'empty' | 'moderate' | 'busy' | 'closed'
 */
export async function updateLocationStatus(
  supabase: SupabaseClient,
  id: number,
  status: LocationStatus,
): Promise<DbResult<Location>> {
  const { data, error } = await supabase
    .from('locations')
    .update({ current_status: status })  // Only update the status field
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error(`[updateLocationStatus] id=${id}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: data as Location, error: null }
}

// ─── RECALCULATE AND UPDATE STATUS BASED ON OCCUPANCY ────────────────────────

/**
 * Automatically determines and updates a location's status based on how many
 * seats are currently taken vs. the total available seats.
 *
 * Call this whenever someone checks in or checks out of a location so the
 * status badge stays accurate in real-time.
 *
 * @param id          - The location to recalculate
 * @param seatsTaken  - How many seats are currently occupied (from active_sessions)
 * @param totalSeats  - The location's total capacity
 */
export async function recalculateLocationStatus(
  supabase: SupabaseClient,
  id: number,
  seatsTaken: number,
  totalSeats: number,
): Promise<DbResult<Location>> {
  // Calculate what percentage of seats are filled
  const fillPercent = totalSeats > 0 ? (seatsTaken / totalSeats) * 100 : 0

  // Map percentage to a status label
  let status: LocationStatus
  if (fillPercent === 0) {
    status = 'empty'
  } else if (fillPercent <= 60) {
    status = 'moderate'
  } else {
    status = 'busy'
  }

  return updateLocationStatus(supabase, id, status)
}
