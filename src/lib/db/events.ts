// ============================================================
// DATABASE QUERIES: EVENTS
// ============================================================
// Handles school events that can block nearby study spots.
//
// HOW IT WORKS:
//   1. An admin creates an event linked to a location
//   2. When a student tries to check in at that location,
//      the app calls isLocationBlockedByEvent() to check
//   3. If blocked, the UI shows "Unavailable — Event in Progress"
//      and prevents check-in
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DbResult, Event } from '@/lib/types/database'

// ─── GET ALL UPCOMING EVENTS ──────────────────────────────────────────────────

/**
 * Fetches all events happening from now onward, sorted by date.
 * Use this to show an events calendar or upcoming alerts.
 */
export async function getUpcomingEvents(
  supabase: SupabaseClient,
): Promise<DbResult<Event[]>> {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .gte('event_date', now)              // .gte = "greater than or equal to" now
    .order('event_date', { ascending: true })  // Soonest events first

  if (error) {
    console.error('[getUpcomingEvents]', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as Event[], error: null }
}

// ─── GET EVENTS AT A SPECIFIC LOCATION ────────────────────────────────────────

/**
 * Fetches all upcoming events happening at or near a specific location.
 * Use this on the location detail page to warn students about upcoming events.
 *
 * @param locationId - The location to check
 */
export async function getEventsAtLocation(
  supabase: SupabaseClient,
  locationId: number,
): Promise<DbResult<Event[]>> {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('location_id', locationId)
    .gte('event_date', now)
    .order('event_date', { ascending: true })

  if (error) {
    console.error(`[getEventsAtLocation] locationId=${locationId}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: data as Event[], error: null }
}

// ─── CHECK IF A LOCATION IS CURRENTLY BLOCKED ────────────────────────────────

/**
 * Checks whether a study spot is currently unavailable due to an ongoing event.
 * Call this before allowing a student to check in.
 *
 * An event "blocks" a location if its event_date is within the last 4 hours
 * (configurable below) — treating the event as still "in progress".
 *
 * @param locationId - The location to check
 * @returns { data: true } if blocked, { data: false } if available
 */
export async function isLocationBlockedByEvent(
  supabase: SupabaseClient,
  locationId: number,
): Promise<DbResult<boolean>> {
  // Consider an event "active" if it started within the last 4 hours
  // Adjust HOURS_CONSIDERED_ACTIVE if your events run shorter or longer
  const HOURS_CONSIDERED_ACTIVE = 4
  const cutoffTime = new Date(
    Date.now() - HOURS_CONSIDERED_ACTIVE * 60 * 60 * 1000,
  ).toISOString()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('events')
    .select('id')
    .eq('location_id', locationId)
    .gte('event_date', cutoffTime)  // Event started after the cutoff (within 4 hours ago)
    .lte('event_date', now)         // Event has already started (not future)
    .limit(1)                       // We only need to know if any event exists

  if (error) {
    console.error(`[isLocationBlockedByEvent] locationId=${locationId}`, error.message)
    return { data: null, error: error.message }
  }

  // If at least one active event was found, the location is blocked
  const isBlocked = data.length > 0

  return { data: isBlocked, error: null }
}

// ─── CREATE EVENT (Admin only) ────────────────────────────────────────────────

/**
 * Creates a new event that will block a study spot.
 * Only admins should be able to call this (enforce via Row Level Security in Supabase).
 *
 * @param title       - Event name, e.g., "Orientation Week"
 * @param eventDate   - ISO datetime string of when the event starts
 * @param locationId  - Which location this event affects
 * @param description - Optional details about the event
 * @param isPeakAlert - Set true to warn nearby areas will be extra crowded
 */
export async function createEvent(
  supabase: SupabaseClient,
  title: string,
  eventDate: string,
  locationId: number,
  description?: string,
  isPeakAlert?: boolean,
): Promise<DbResult<Event>> {
  const { data, error } = await supabase
    .from('events')
    .insert({
      title,
      event_date: eventDate,
      location_id: locationId,
      description: description ?? null,
      is_peak_alert: isPeakAlert ?? false,
    })
    .select()
    .single()

  if (error) {
    console.error('[createEvent]', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as Event, error: null }
}
