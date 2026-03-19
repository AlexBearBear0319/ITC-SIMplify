// ============================================================
// DATABASE QUERIES: POINTS & REWARDS
// ============================================================
// Functions for the gamification system: earning points, completing
// missions, and redeeming rewards from the store.
//
// POINTS FLOW:
//   1. Student does an action (check-in, review, join group...)
//   2. App calls awardPoints() → looks up the rule, adds points to profile
//   3. App checks for completed missions → awards bonus points
//   4. Student redeems points for items → calls redeemItem()
//
// POINT RULES are stored in the `point_rules` table.
// Admins can adjust how many points each action gives without
// changing any code — just update the database row.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DbResult, Mission, PointRule, RedemptionItem, UserMission, UserRedemption } from '@/lib/types/database'

// ─── ACTION NAMES ─────────────────────────────────────────────────────────────

/**
 * The names of actions that can earn points.
 * These must match exactly what's stored in the `point_rules.action_name` column.
 */
export const POINT_ACTIONS = {
  CHECK_IN: 'check_in',
  LEAVE_REVIEW: 'leave_review',
  JOIN_STUDY_GROUP: 'study_group_join',
  CREATE_STUDY_GROUP: 'study_group_create',
} as const

export type PointAction = typeof POINT_ACTIONS[keyof typeof POINT_ACTIONS]

// ─── AWARD POINTS ─────────────────────────────────────────────────────────────

/**
 * Awards points to a student for completing an action.
 *
 * Steps:
 *   1. Looks up how many points the action is worth (from point_rules table)
 *   2. Adds those points to the student's profile
 *   3. Returns the updated point total
 *
 * Cooldown: If the action has a cooldown set, and the student did it recently,
 * no points are awarded. (Full cooldown logic would require a points_log table —
 * add that to Supabase if you want strict enforcement.)
 *
 * @param userId     - The student receiving the points
 * @param actionName - The action being rewarded (use POINT_ACTIONS constants above)
 */
export async function awardPoints(
  supabase: SupabaseClient,
  userId: string,
  actionName: PointAction,
): Promise<DbResult<number>> {
  // Step 1: Find the point rule for this action
  const { data: rule, error: ruleError } = await supabase
    .from('point_rules')
    .select('*')
    .eq('action_name', actionName)
    .eq('is_active', true)
    .single()

  if (ruleError || !rule) {
    // No rule found means this action doesn't earn points (or is disabled)
    console.warn(`[awardPoints] No active rule for action: ${actionName}`)
    return { data: 0, error: null }
  }

  const pointsToAdd = (rule as PointRule).points_awarded ?? 0

  // Step 2: Add points to the student's profile using a Postgres RPC function.
  // We use an RPC (remote procedure call) to do the math on the database side,
  // which avoids race conditions if multiple check-ins happen at the same time.
  //
  // NOTE: You need to create this function in Supabase SQL Editor:
  //
  //   create or replace function increment_points(user_id uuid, amount integer)
  //   returns integer language plpgsql as $$
  //   declare new_total integer;
  //   begin
  //     update profiles set points = points + amount where id = user_id
  //     returning points into new_total;
  //     return new_total;
  //   end;
  //   $$;
  //
  const { data: newTotal, error: updateError } = await supabase
    .rpc('increment_points', { user_id: userId, amount: pointsToAdd })

  if (updateError) {
    console.error(`[awardPoints] Failed to add points for ${actionName}:`, updateError.message)
    return { data: null, error: updateError.message }
  }

  return { data: newTotal as number, error: null }
}

// ─── GET POINT RULES ──────────────────────────────────────────────────────────

/**
 * Fetches all active point rules.
 * Use this to display a "how to earn points" guide in the app.
 */
export async function getPointRules(
  supabase: SupabaseClient,
): Promise<DbResult<PointRule[]>> {
  const { data, error } = await supabase
    .from('point_rules')
    .select('*')
    .eq('is_active', true)
    .order('action_name')

  if (error) {
    console.error('[getPointRules]', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as PointRule[], error: null }
}

// ─── REDEMPTION STORE ─────────────────────────────────────────────────────────

/**
 * Fetches all items available in the rewards store.
 * Only shows items that are active and still in stock.
 */
export async function getRedemptionItems(
  supabase: SupabaseClient,
): Promise<DbResult<RedemptionItem[]>> {
  const { data, error } = await supabase
    .from('redemption_items')
    .select('*')
    .eq('is_active', true)
    .gt('stock', 0)              // Only show items that are in stock
    .order('cost', { ascending: true })  // Cheapest items first

  if (error) {
    console.error('[getRedemptionItems]', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as RedemptionItem[], error: null }
}

/**
 * Redeems a reward item for a student.
 * Deducts the item's cost from their points and creates a redemption record.
 *
 * Returns an error if:
 *   - The student doesn't have enough points
 *   - The item is out of stock
 *
 * @param userId - The student redeeming the item
 * @param itemId - The reward item they want
 */
export async function redeemItem(
  supabase: SupabaseClient,
  userId: string,
  itemId: number,
): Promise<DbResult<UserRedemption>> {
  // Step 1: Fetch the item and the student's current points together
  const [itemResult, profileResult] = await Promise.all([
    supabase.from('redemption_items').select('cost, stock, is_active').eq('id', itemId).single(),
    supabase.from('profiles').select('points').eq('id', userId).single(),
  ])

  if (itemResult.error || !itemResult.data) {
    return { data: null, error: 'Item not found.' }
  }
  if (profileResult.error || !profileResult.data) {
    return { data: null, error: 'Profile not found.' }
  }

  const item = itemResult.data
  const profile = profileResult.data

  // Step 2: Validate stock and points
  if (!item.is_active || item.stock <= 0) {
    return { data: null, error: 'This item is no longer available.' }
  }
  if ((profile.points ?? 0) < item.cost) {
    return { data: null, error: `Not enough points. You need ${item.cost} points.` }
  }

  // Step 3: Deduct points from the student's profile
  const { error: deductError } = await supabase
    .from('profiles')
    .update({ points: (profile.points ?? 0) - item.cost })
    .eq('id', userId)

  if (deductError) {
    console.error('[redeemItem] Failed to deduct points:', deductError.message)
    return { data: null, error: deductError.message }
  }

  // Step 4: Decrement the item's stock
  await supabase
    .from('redemption_items')
    .update({ stock: item.stock - 1 })
    .eq('id', itemId)

  // Step 5: Create the redemption record
  const { data: redemption, error: redemptionError } = await supabase
    .from('user_redemptions')
    .insert({ user_id: userId, item_id: itemId, status: 'pending' })
    .select()
    .single()

  if (redemptionError) {
    console.error('[redeemItem] Failed to create redemption record:', redemptionError.message)
    return { data: null, error: redemptionError.message }
  }

  return { data: redemption as UserRedemption, error: null }
}

/**
 * Fetches a student's full redemption history.
 *
 * @param userId - The student's profile ID
 */
export async function getUserRedemptions(
  supabase: SupabaseClient,
  userId: string,
): Promise<DbResult<UserRedemption[]>> {
  const { data, error } = await supabase
    .from('user_redemptions')
    .select('*')
    .eq('user_id', userId)
    .order('redeemed_at', { ascending: false })

  if (error) {
    console.error(`[getUserRedemptions] userId=${userId}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: data as UserRedemption[], error: null }
}

// ─── MISSIONS ─────────────────────────────────────────────────────────────────

/**
 * Fetches all missions (challenges) together with the student's progress on each.
 * Use this to display the missions/challenges screen.
 *
 * Returns each mission as a UserMission row (with progress + is_completed).
 * If the student hasn't started a mission yet, it won't appear in this list.
 *
 * @param userId - The student to fetch missions for
 */
export async function getUserMissions(
  supabase: SupabaseClient,
  userId: string,
): Promise<DbResult<UserMission[]>> {
  const { data, error } = await supabase
    .from('user_mission')
    .select('*, missions(*)')   // Join with the missions table to get mission details
    .eq('user_id', userId)
    .order('last_updated', { ascending: false })

  if (error) {
    console.error(`[getUserMissions] userId=${userId}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: data as UserMission[], error: null }
}

/**
 * Fetches all available missions (regardless of user progress).
 * Use this to show the full mission list, including ones not yet started.
 */
export async function getAllMissions(
  supabase: SupabaseClient,
): Promise<DbResult<Mission[]>> {
  const { data, error } = await supabase
    .from('missions')
    .select('*')
    .order('reward_points', { ascending: false })  // Highest reward first

  if (error) {
    console.error('[getAllMissions]', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as Mission[], error: null }
}

/**
 * Updates a student's progress on a specific mission.
 * Call this whenever they do an action that counts toward a mission.
 * If progress reaches target_count, marks the mission as completed
 * and awards the bonus points.
 *
 * @param userId    - The student
 * @param missionId - The mission to update
 * @param newProgress - The new progress count (e.g., 3 check-ins done out of 5)
 */
export async function updateMissionProgress(
  supabase: SupabaseClient,
  userId: string,
  missionId: number,
  newProgress: number,
): Promise<DbResult<UserMission>> {
  // First, get the mission to know the target_count and reward
  const { data: mission, error: missionError } = await supabase
    .from('missions')
    .select('target_count, reward_points')
    .eq('id', missionId)
    .single()

  if (missionError || !mission) {
    return { data: null, error: missionError?.message ?? 'Mission not found' }
  }

  const isCompleted = newProgress >= (mission.target_count ?? 1)

  // Update or insert the user_mission record
  const { data, error } = await supabase
    .from('user_mission')
    .upsert(
      {
        user_id: userId,
        mission_id: missionId,
        progress: newProgress,
        is_completed: isCompleted,
        last_updated: new Date().toISOString(),
      },
      { onConflict: 'user_id,mission_id' },  // Update if already exists
    )
    .select()
    .single()

  if (error) {
    console.error('[updateMissionProgress]', error.message)
    return { data: null, error: error.message }
  }

  // If mission was just completed, award the bonus points
  if (isCompleted && (mission.reward_points ?? 0) > 0) {
    await supabase.rpc('increment_points', {
      user_id: userId,
      amount: mission.reward_points,
    })
  }

  return { data: data as UserMission, error: null }
}
