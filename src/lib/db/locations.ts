// Database queries for study spot locations.
// Pass a Supabase client (server or browser) as the first argument to each function.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DbResult, Location, LocationStatus } from '@/lib/types/database'

// ─── FILTER OPTIONS ──────────────────────────────────────────────────────────

export type LocationFilters = {
  category?: string          // e.g., "Library", "Cafe", "Outdoor"
  hasPowerOutlets?: boolean  // true = only spots with ≥ 1 outlet
  status?: LocationStatus
}

// ─── GET ALL LOCATIONS ────────────────────────────────────────────────────────

/** Fetches all study spots, sorted alphabetically. */
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

/** Fetches a single study spot by ID. Used on the location detail page. */
export async function getLocationById(
  supabase: SupabaseClient,
  id: number,
): Promise<DbResult<Location>> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error(`[getLocationById] id=${id}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: data as Location, error: null }
}

// ─── GET LOCATION BY QR TOKEN ─────────────────────────────────────────────────

/**
 * Finds a study spot by the UUID encoded in its physical QR code.
 * Called immediately after a successful QR scan.
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
 * Fetches study spots matching optional filters.
 * All filter fields are optional — only the ones provided are applied.
 */
export async function getLocationsWithFilters(
  supabase: SupabaseClient,
  filters: LocationFilters,
): Promise<DbResult<Location[]>> {
  let query = supabase.from('locations').select('*')

  if (filters.category)            query = query.eq('category', filters.category)
  if (filters.hasPowerOutlets)     query = query.gt('power_outlets', 0)
  if (filters.status)              query = query.eq('current_status', filters.status)

  const { data, error } = await query.order('name', { ascending: true })

  if (error) {
    console.error('[getLocationsWithFilters]', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as Location[], error: null }
}

// ─── UPDATE LOCATION STATUS ───────────────────────────────────────────────────

/**
 * Directly sets a location's occupancy status.
 * Prefer `recalculateLocationStatus` for check-in/out flows;
 * use this for manual admin overrides.
 */
export async function updateLocationStatus(
  supabase: SupabaseClient,
  id: number,
  status: LocationStatus,
): Promise<DbResult<Location>> {
  const { data, error } = await supabase
    .from('locations')
    .update({ current_status: status })
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
 * Derives and saves the correct status for a location based on current seat occupancy.
 * Call this after every check-in or check-out so the live status badge stays accurate.
 *
 * Thresholds: 0% → empty · 1–60% → empty · 61–90% → busy · 91%+ → full
 */
export async function recalculateLocationStatus(
  supabase: SupabaseClient,
  id: number,
  seatsTaken: number,
  totalSeats: number,
): Promise<DbResult<Location>> {
  const fillPct = totalSeats > 0 ? (seatsTaken / totalSeats) * 100 : 0
  const status: LocationStatus =
    fillPct === 0 ? 'empty' : fillPct <= 60 ? 'empty' : fillPct <= 90 ? 'busy' : 'full'

  return updateLocationStatus(supabase, id, status)
}
