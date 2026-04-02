/** Database helpers for campus events and event-based location blocking. */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DbResult, Event } from '@/lib/types/database'


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
    .gte('event_date', now)
    .order('event_date', { ascending: true })

  if (error) {
    console.error('[getUpcomingEvents]', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as Event[], error: null }
}


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
  // Treat events as active for a fixed window after start time.
  const HOURS_CONSIDERED_ACTIVE = 4
  const cutoffTime = new Date(
    Date.now() - HOURS_CONSIDERED_ACTIVE * 60 * 60 * 1000,
  ).toISOString()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('events')
    .select('id')
    .eq('location_id', locationId)
    .gte('event_date', cutoffTime)
    .lte('event_date', now)
    .limit(1)

  if (error) {
    console.error(`[isLocationBlockedByEvent] locationId=${locationId}`, error.message)
    return { data: null, error: error.message }
  }

  const isBlocked = data.length > 0

  return { data: isBlocked, error: null }
}


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
