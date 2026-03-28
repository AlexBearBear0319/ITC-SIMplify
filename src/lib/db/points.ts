// ============================================================
// DB QUERIES: POINTS & REWARDS
// ============================================================
// All the gamification stuff: earning points, missions, redeeming rewards.
//
// How points work:
//   1. Student does something (check-in, leaves a review, joins a group...)
//   2. We call awardPoints() which looks up the rule and adds to their profile
//   3. After that we check if any missions got completed and award bonus points
//   4. Student can redeem their points for rewards via redeemItem()
//
// Point values are stored in the point_rules table so admins can change
// how much each action is worth without touching any code, just update the DB row.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DbResult, Mission, PointRule, RedemptionItem, UserMission, UserRedemption } from '@/lib/types/database'

// ─── ACTION NAMES ─────────────────────────────────────────────────────────────

/**
 * Constants for the action names we use to look up point rules.
 * These strings have to match exactly what's in the point_rules.action_name column,
 * so using constants here means we dont have to remember the exact strings everywhere.
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
 * Gives points to a student for completing an action.
 *
 * Two steps:
 *   1. Look up how many points the action is worth from point_rules
 *   2. Add that amount to the student's profile using an RPC call
 *
 * We use an RPC (stored procedure on the DB side) instead of doing
 * points = points + X on the client, because if two check-ins happen
 * at the same time they could both read the same old value and one
 * update would overwrite the other. The RPC handles this atomically
 * (similar to how you'd use a mutex in OS / concurrency lecture stuff).
 *
 * If no rule is found for the action, we just return 0 points, not an error.
 * That way disabled actions silently do nothing.
 *
 * @param userId     - the student getting the points
 * @param actionName - which action they did (use POINT_ACTIONS constants)
 */
export async function awardPoints(
  supabase: SupabaseClient,
  userId: string,
  actionName: PointAction,
): Promise<DbResult<number>> {
  // look up the point rule for this action
  const { data: rule, error: ruleError } = await supabase
    .from('point_rules')
    .select('*')
    .eq('action_name', actionName)
    .eq('is_active', true)
    .single()

  if (ruleError || !rule) {
    // no rule means this action doesnt give points or its been disabled
    console.warn(`[awardPoints] no active rule for action: ${actionName}`)
    return { data: 0, error: null }
  }

  const pointsToAdd = (rule as PointRule).points_awarded ?? 0

  // use increment_points RPC to do the addition on the DB side
  // avoids race conditions if two updates happen at the same time
  //
  // you need this function in Supabase SQL Editor:
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
    console.error(`[awardPoints] failed to add points for ${actionName}:`, updateError.message)
    return { data: null, error: updateError.message }
  }

  return { data: newTotal as number, error: null }
}

// ─── GET POINT RULES ──────────────────────────────────────────────────────────

/**
 * Gets all active point rules from the DB.
 * Could use this to show a "how to earn points" list somewhere in the UI.
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
 * Gets all items currently available in the rewards store.
 * Filters to only show items that are active and still in stock.
 * Sorted cheapest first so students can see what they can afford.
 */
export async function getRedemptionItems(
  supabase: SupabaseClient,
): Promise<DbResult<RedemptionItem[]>> {
  const { data, error } = await supabase
    .from('redemption_items')
    .select('*')
    .eq('is_active', true)
    .gt('stock', 0)              // only show items that are still in stock
    .order('cost', { ascending: true })  // cheapest first

  if (error) {
    console.error('[getRedemptionItems]', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as RedemptionItem[], error: null }
}

/**
 * Redeems a reward item for a student.
 * Deducts the item cost from their points and creates a redemption record.
 *
 * Multi-step process (basically a mini-transaction):
 *   1. Fetch the item and student profile at the same time (Promise.all so its not sequential)
 *   2. Check stock and that they have enough points
 *   3. Deduct points from profile
 *   4. Decrement item stock
 *   5. Create the redemption record
 *
 * Returns an error early if they cant afford it or item is sold out.
 *
 * @param userId - the student buying the reward
 * @param itemId - the reward item they want
 */
export async function redeemItem(
  supabase: SupabaseClient,
  userId: string,
  itemId: number,
): Promise<DbResult<UserRedemption>> {
  // fetch the item and profile in parallel since they dont depend on each other
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

  // validate before we touch anything
  if (!item.is_active || item.stock <= 0) {
    return { data: null, error: 'This item is no longer available.' }
  }
  if ((profile.points ?? 0) < item.cost) {
    return { data: null, error: `Not enough points. You need ${item.cost} points.` }
  }

  // deduct the cost from their profile
  const { error: deductError } = await supabase
    .from('profiles')
    .update({ points: (profile.points ?? 0) - item.cost })
    .eq('id', userId)

  if (deductError) {
    console.error('[redeemItem] failed to deduct points:', deductError.message)
    return { data: null, error: deductError.message }
  }

  // reduce the stock by 1
  await supabase
    .from('redemption_items')
    .update({ stock: item.stock - 1 })
    .eq('id', itemId)

  // create the redemption record (status starts as "pending" until admin confirms)
  const { data: redemption, error: redemptionError } = await supabase
    .from('user_redemptions')
    .insert({ user_id: userId, item_id: itemId, status: 'pending' })
    .select()
    .single()

  if (redemptionError) {
    console.error('[redeemItem] failed to create redemption record:', redemptionError.message)
    return { data: null, error: redemptionError.message }
  }

  return { data: redemption as UserRedemption, error: null }
}

/**
 * Gets all redemptions a student has made, newest first.
 * Shows their purchase history basically.
 *
 * @param userId - the student's profile ID
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
 * Gets all missions with the student's progress on each one.
 * Does a join with the missions table so we get the mission details too.
 *
 * Only shows missions the student has started. If they havent touched a
 * mission yet it wont appear here (no row in user_mission yet).
 *
 * @param userId - the student to get missions for
 */
export async function getUserMissions(
  supabase: SupabaseClient,
  userId: string,
): Promise<DbResult<UserMission[]>> {
  const { data, error } = await supabase
    .from('user_mission')
    .select('*, missions(*)')   // join to get the mission details alongside progress
    .eq('user_id', userId)
    .order('last_updated', { ascending: false })

  if (error) {
    console.error(`[getUserMissions] userId=${userId}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: data as UserMission[], error: null }
}

/**
 * Gets every mission regardless of whether the student has started it.
 * Use this for showing the full mission list including ones they havent touched.
 * Sorted by reward so the most valuable ones show up first.
 */
export async function getAllMissions(
  supabase: SupabaseClient,
): Promise<DbResult<Mission[]>> {
  const { data, error } = await supabase
    .from('missions')
    .select('*')
    .order('reward_points', { ascending: false })  // highest reward first

  if (error) {
    console.error('[getAllMissions]', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as Mission[], error: null }
}

/**
 * Updates the student's progress on a specific mission.
 * Call this whenever they do something that counts toward the mission.
 *
 * Uses upsert so it handles both the "first update" and "subsequent updates" cases
 * without needing a separate check (like INSERT ... ON CONFLICT DO UPDATE in SQL).
 *
 * If newProgress hits the target_count, the mission gets marked as completed and
 * we award the bonus points automatically.
 *
 * @param userId      - the student
 * @param missionId   - which mission to update
 * @param newProgress - their new progress count, e.g. 3 check-ins out of 5
 */
export async function updateMissionProgress(
  supabase: SupabaseClient,
  userId: string,
  missionId: number,
  newProgress: number,
): Promise<DbResult<UserMission>> {
  // get the mission so we know the target and reward amount
  const { data: mission, error: missionError } = await supabase
    .from('missions')
    .select('target_count, reward_points')
    .eq('id', missionId)
    .single()

  if (missionError || !mission) {
    return { data: null, error: missionError?.message ?? 'Mission not found' }
  }

  const isCompleted = newProgress >= (mission.target_count ?? 1)

  // upsert the progress row (insert if new, update if already exists)
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
      { onConflict: 'user_id,mission_id' },  // if the row already exists, update it
    )
    .select()
    .single()

  if (error) {
    console.error('[updateMissionProgress]', error.message)
    return { data: null, error: error.message }
  }

  // if they just completed the mission, give them the bonus points
  if (isCompleted && (mission.reward_points ?? 0) > 0) {
    await supabase.rpc('increment_points', {
      user_id: userId,
      amount: mission.reward_points,
    })
  }

  return { data: data as UserMission, error: null }
}
