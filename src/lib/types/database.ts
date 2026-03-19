// ============================================================
// DATABASE TYPES — Mirrors our Supabase (PostgreSQL) tables
// ============================================================
// These TypeScript types define the shape of data coming from the database.
// Every row you fetch from Supabase will match one of these types.
//
// HOW TO USE:
//   import type { Location, Profile, ActiveSession } from '@/lib/types/database'
//
// WHY THIS MATTERS:
//   TypeScript will catch bugs at compile time — e.g., if you try to access
//   a field that doesn't exist, the editor will show an error immediately.
// ============================================================

// ─── ENUMS ──────────────────────────────────────────────────────────────────

/**
 * The possible occupancy statuses of a study spot.
 * - 'empty'    → No one is there, feel free to go!
 * - 'moderate' → Some people, but seats are still available
 * - 'busy'     → Almost full — might be noisy or cramped
 * - 'closed'   → Unavailable (e.g., an event is happening nearby)
 */
export type LocationStatus = 'empty' | 'moderate' | 'busy' | 'closed'

// ─── TABLES ─────────────────────────────────────────────────────────────────

/**
 * A study spot / location on campus.
 * Matches the `locations` table in Supabase.
 */
export type Location = {
  id: number
  name: string                       // e.g., "Library Level 2", "Canteen Corner"
  category: string | null            // e.g., "Library", "Cafe", "Outdoor"
  current_status: LocationStatus | null
  coordinates_x: number | null       // X coordinate for placing pin on campus map
  coordinates_y: number | null       // Y coordinate for placing pin on campus map
  image_url: string | null           // Main photo of the spot
  created_at: string | null
  qr_token: string | null            // Unique UUID used for QR code check-in
  images: string[] | null            // Array of photo URLs (gallery)
  location_text: string | null       // Human-readable description of where it is
  opening_time: string | null        // e.g., "8:00 AM – 10:00 PM"
  total_seats: number | null         // Maximum number of people that can be seated
  power_outlets: number | null       // Number of available charging ports
  description: string | null         // Extra details about the spot
}

/**
 * A student's profile / account in the app.
 * Matches the `profiles` table in Supabase.
 * Each profile is linked to a Supabase Auth user (same UUID).
 */
export type Profile = {
  id: string                         // UUID — same as the user's auth.users id
  username: string | null
  avatar_url: string | null
  points: number | null              // Total points the student has earned
  level: number | null               // Calculated tier based on points
  updated_at: string | null
  full_name: string | null
  streak_days: number | null         // How many days in a row they've checked in
  last_checkin_at: string | null     // Timestamp of their most recent check-in
  is_admin: boolean | null           // Admin users can manage locations and events
}

/**
 * A record of a student currently occupying a study spot.
 * Matches the `active_sessions` table in Supabase.
 * Created on check-in, marked inactive on check-out.
 */
export type ActiveSession = {
  id: number
  user_id: string | null             // Which student is at the spot
  location_id: number | null         // Which spot they're at
  seats_taken: number | null         // How many seats their group occupies (default: 1)
  activity: string                   // What they're doing, e.g., "Studying", "Group Work"
  module: string | null              // Subject/module code, e.g., "CS101", "MAT201"
  duration_minutes: number           // How long they plan to stay
  check_in_time: string | null       // When they checked in (ISO datetime)
  is_active: boolean | null          // true = still there, false = checked out
}

/**
 * A school event that can block a nearby study spot.
 * Matches the `events` table in Supabase.
 * When an event is active at a location, students cannot check in there.
 */
export type Event = {
  id: number
  title: string                      // e.g., "Orientation Day", "Career Fair"
  description: string | null
  event_date: string                 // ISO datetime — when the event happens
  location_id: number | null         // Which location is affected
  is_peak_alert: boolean | null      // If true, warns nearby areas will be extra crowded
  created_at: string | null
}

/**
 * A mission / challenge students can complete to earn bonus points.
 * Matches the `missions` table in Supabase.
 */
export type Mission = {
  id: number
  title: string                      // e.g., "Check in 5 times this week"
  description: string | null
  target_action: string | null       // The action type that counts, e.g., "check_in"
  target_count: number | null        // How many times they need to do the action
  reward_points: number | null       // Bonus points awarded on completion
  period: string | null              // e.g., "daily", "weekly", "one-time"
  icon: string | null                // Emoji or icon name for display in the UI
}

/**
 * Rules defining how many points are awarded for each user action.
 * Matches the `point_rules` table in Supabase.
 * The admin can adjust these to tune the rewards system.
 */
export type PointRule = {
  id: number
  action_name: string                // e.g., "check_in", "leave_review", "study_group_join"
  points_awarded: number | null      // Points given when this action is performed
  cooldown_minutes: number | null    // How long before the same action earns points again
  is_active: boolean | null          // If false, this action no longer earns points
}

/**
 * A reward item that students can redeem using their points.
 * Matches the `redemption_items` table in Supabase.
 */
export type RedemptionItem = {
  id: number
  name: string                       // e.g., "Free Coffee Voucher", "IT Club Sticker Pack"
  description: string | null
  cost: number                       // How many points needed to redeem
  stock: number | null               // How many are left (0 = out of stock)
  is_active: boolean | null          // If false, hidden from the redemption store
  image_url: string | null
}

/**
 * A student's review of a study spot.
 * Matches the `reviews` table in Supabase.
 */
export type Review = {
  id: number
  location_id: number | null
  user_id: string | null
  rating: number | null              // 1–5 stars
  comment: string | null             // Optional written feedback
  created_at: string | null
}

/**
 * A log entry recording when a location's status changed.
 * Matches the `status_logs` table in Supabase.
 * Useful for analytics — e.g., tracking peak hours.
 */
export type StatusLog = {
  id: number
  user_id: string | null             // Who triggered the change (or null if automatic)
  location_id: number | null
  status: string | null              // The new status that was set
  created_at: string | null
}

/**
 * A study group created by a student at a location.
 * Matches the `study_groups` table in Supabase.
 * Students can join groups to study the same subject together.
 */
export type StudyGroup = {
  id: number
  host_id: string | null             // The student who created and hosts the group
  location_id: number | null         // Where the group is meeting
  subject: string                    // What they're studying, e.g., "Linear Algebra", "CS101"
  max_members: number | null         // Maximum group size (default: 5)
  current_members: number | null     // Current number of people in the group
  is_active: boolean | null          // false = group has ended or been disbanded
  created_at: string | null
  description: string | null         // Extra details about the session (e.g., topics covered)
  expires_at: string | null          // When the group session is expected to end
}

/**
 * A record linking a student to a study group they've joined.
 * Matches the `study_group_members` table in Supabase.
 */
export type StudyGroupMember = {
  id: number
  group_id: number
  user_id: string
  joined_at: string | null
}

/**
 * Tracks a student's progress on a specific mission.
 * Matches the `user_mission` table in Supabase.
 */
export type UserMission = {
  id: number
  user_id: string | null
  mission_id: number | null
  progress: number | null            // e.g., 3 out of 5 check-ins completed
  is_completed: boolean | null
  last_updated: string | null
}

/**
 * A record of a student redeeming a reward item.
 * Matches the `user_redemptions` table in Supabase.
 */
export type UserRedemption = {
  id: number
  user_id: string | null
  item_id: number | null
  redeemed_at: string | null
  status: string | null              // "pending" → "claimed" or "cancelled"
}

// ─── HELPER TYPE ─────────────────────────────────────────────────────────────

/**
 * A standard return type for all database query functions.
 * Every DB function returns either { data: T, error: null }
 * or { data: null, error: "error message string" }.
 *
 * This makes error handling consistent and predictable across the app.
 *
 * HOW TO USE:
 *   const { data, error } = await getAllLocations(supabase)
 *   if (error) { show error message }
 *   else { use data }
 */
export type DbResult<T> = { data: T; error: null } | { data: null; error: string }
