// TypeScript types mirroring the Supabase (PostgreSQL) schema.
// Import from here rather than defining inline types in pages.
//
//   import type { Location, Profile, ActiveSession } from '@/lib/types/database'

// ─── ENUMS ──────────────────────────────────────────────────────────────────

/**
 * Maps to the `location_status` Postgres enum.
 * Written and read throughout the app — do not add values here without
 * also adding them to the DB enum definition.
 */
export type LocationStatus = 'empty' | 'busy' | 'full'

// ─── TABLES ─────────────────────────────────────────────────────────────────

/**
 * A study spot / location on campus.
 * Matches the `locations` table in Supabase.
 */
export type Location = {
  id: number
  name: string
  category: string | null
  current_status: LocationStatus | null
  coordinates_x: number | null
  coordinates_y: number | null
  image_url: string | null
  created_at: string | null
  qr_token: string | null            // UUID encoded in the physical QR code
  images: string[] | null
  location_text: string | null
  opening_time: string | null
  total_seats: number | null
  power_outlets: number | null
  description: string | null
}

/**
 * A student's profile / account in the app.
 * Matches the `profiles` table in Supabase.
 * `id` is the same UUID as the auth.users row — no separate join needed.
 */
export type Profile = {
  id: string
  username: string | null
  avatar_url: string | null
  points: number | null
  level: number | null               // 1–5, mirrors the LEVELS tiers in src/lib/levels.ts
  updated_at: string | null
  full_name: string | null
  streak_days: number | null
  last_checkin_at: string | null
  is_admin: boolean | null
}

/**
 * A record of a student currently occupying a study spot.
 * Matches the `active_sessions` table in Supabase.
 * Created on check-in, soft-deleted (is_active = false) on check-out.
 */
export type ActiveSession = {
  id: number
  user_id: string | null
  location_id: number | null
  seats_taken: number | null
  activity: string
  module: string | null
  duration_minutes: number
  check_in_time: string | null
  is_active: boolean | null
}

/** Matches the `events` table. */
export type Event = {
  id: number
  title: string
  description: string | null
  event_date: string
  location_id: number | null
  is_peak_alert: boolean | null      // When true, nearby spots show a crowd warning
  created_at: string | null
}

/** Matches the `missions` table. */
export type Mission = {
  id: number
  title: string
  description: string | null
  target_action: string | null       // e.g., "check_in" — the action type that counts
  target_count: number | null
  reward_points: number | null
  period: string | null              // e.g., "daily", "weekly"
  icon: string | null
}

/**
 * Matches the `point_rules` table.
 * Admins can tune `points_awarded` and `cooldown_minutes` per action via the admin panel.
 */
export type PointRule = {
  id: number
  action_name: string                // e.g., "check_in", "leave_review"
  points_awarded: number | null
  cooldown_minutes: number | null
  is_active: boolean | null
}

/** Matches the `redemption_items` table. Note: no `category` column in DB yet. */
export type RedemptionItem = {
  id: number
  name: string
  description: string | null
  cost: number
  stock: number | null
  is_active: boolean | null
  image_url: string | null
}

/** Matches the `reviews` table. */
export type Review = {
  id: number
  location_id: number | null
  user_id: string | null
  rating: number | null              // 1–5 stars
  comment: string | null
  created_at: string | null
}

/** Matches the `status_logs` table. Used for analytics (peak hours, etc.). */
export type StatusLog = {
  id: number
  user_id: string | null
  location_id: number | null
  status: string | null
  created_at: string | null
}

/** Matches the `study_groups` table. */
export type StudyGroup = {
  id: number
  host_id: string | null
  location_id: number | null
  subject: string
  max_members: number | null
  current_members: number | null
  is_active: boolean | null          // Set to false when the host leaves (group disbanded)
  created_at: string | null
  description: string | null
  expires_at: string | null
}

/** Matches the `study_group_members` junction table. */
export type StudyGroupMember = {
  id: number
  group_id: number
  user_id: string
  joined_at: string | null
}

/** Matches the `user_mission` table. Tracks per-user mission progress. */
export type UserMission = {
  id: number
  user_id: string | null
  mission_id: number | null
  progress: number | null
  is_completed: boolean | null
  last_updated: string | null
}

/** Matches the `user_redemptions` table. */
export type UserRedemption = {
  id: number
  user_id: string | null
  item_id: number | null
  redeemed_at: string | null
  status: string | null              // "pending" → "claimed" or "cancelled"
}

// ─── HELPER TYPE ─────────────────────────────────────────────────────────────

/**
 * Standard return wrapper for all DB query functions.
 * Callers always get either data or an error string — never both.
 *
 *   const { data, error } = await getAllLocations(supabase)
 *   if (error) { ... } else { use data }
 */
export type DbResult<T> = { data: T; error: null } | { data: null; error: string }
