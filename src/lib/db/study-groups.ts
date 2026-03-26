// ============================================================
// DB QUERIES: STUDY GROUPS (Study Buddy feature)
// ============================================================
// All the functions we need to create and manage study groups.
//
// QUICK OVERVIEW of how the feature works:
//   1. Student checks in at a location
//   2. They can start a Study Group (e.g. "CS101 Finals Prep")
//   3. Other students on the finder page can see it
//   4. They join if there are open spots
//   5. Can filter by subject to find people studying the same thing
//
// Study Buddy vs Study Group:
//   - "Study Buddy" is per-session (see sessions.ts)
//   - "Study Group" is a named group others can join (this file)
//   They work together basically.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DbResult, StudyGroup, StudyGroupMember } from '@/lib/types/database'

// ─── GET ACTIVE STUDY GROUPS AT A LOCATION ───────────────────────────────────

/**
 * Gets all currently active study groups at a specific location.
 * We also filter out expired ones just in case expires_at was set.
 *
 * @param locationId - which location to look at
 */
export async function getStudyGroupsAtLocation(
  supabase: SupabaseClient,
  locationId: number,
): Promise<DbResult<StudyGroup[]>> {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('study_groups')
    .select('*')
    .eq('location_id', locationId)
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gt.${now}`)  // not expired yet
    .order('created_at', { ascending: false })

  if (error) {
    console.error(`[getStudyGroupsAtLocation] locationId=${locationId}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: data as StudyGroup[], error: null }
}

// ─── FILTER STUDY GROUPS BY MODULE ────────────────────────────────────────────

/**
 * Gets active study groups filtering by subject/module.
 * Works across all locations so you can find people studying CS101
 * even if they're in a different spot.
 *
 * Uses ilike for case-insensitive partial matching, so "cs101" matches "CS101".
 *
 * @param module - the subject to search for, e.g. "CS101", "MAT201"
 */
export async function getStudyGroupsByModule(
  supabase: SupabaseClient,
  module: string,
): Promise<DbResult<StudyGroup[]>> {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('study_groups')
    .select('*')
    .eq('is_active', true)
    .ilike('subject', `%${module}%`)  // case-insensitive partial match
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error(`[getStudyGroupsByModule] module=${module}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: data as StudyGroup[], error: null }
}

// ─── GET STUDY GROUP MEMBERS ──────────────────────────────────────────────────

/**
 * Gets the list of students currently in a study group.
 * Ordered by who joined first (ascending joined_at).
 *
 * @param groupId - the group we want members for
 */
export async function getStudyGroupMembers(
  supabase: SupabaseClient,
  groupId: number,
): Promise<DbResult<StudyGroupMember[]>> {
  const { data, error } = await supabase
    .from('study_group_members')
    .select('*')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true })

  if (error) {
    console.error(`[getStudyGroupMembers] groupId=${groupId}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: data as StudyGroupMember[], error: null }
}

// ─── CREATE STUDY GROUP ───────────────────────────────────────────────────────

/**
 * What you need to pass in when creating a new study group.
 */
export type CreateStudyGroupData = {
  host_id: string         // the student creating the group
  location_id: number     // where the group is meeting
  subject: string         // what they're studying, e.g. "CS101 Finals"
  max_members?: number    // max group size (defaults to 5)
  description?: string    // extra info about what topics they're covering
  expires_at?: string     // ISO datetime, when the session ends (optional)
}

/**
 * Creates a new study group and adds the host as the first member.
 *
 * Two-step process (like a transaction kind of):
 *   Step 1: insert the group row
 *   Step 2: insert the host into study_group_members
 *
 * If step 2 fails we delete the group we just created so we don't
 * end up with orphaned rows in the DB.
 *
 * @param groupData - the details for the new group (see CreateStudyGroupData)
 */
export async function createStudyGroup(
  supabase: SupabaseClient,
  groupData: CreateStudyGroupData,
): Promise<DbResult<StudyGroup>> {
  // step 1: create the group row
  const { data: group, error: groupError } = await supabase
    .from('study_groups')
    .insert({
      host_id: groupData.host_id,
      location_id: groupData.location_id,
      subject: groupData.subject,
      max_members: groupData.max_members ?? 5,
      current_members: 1,                          // host counts as the first member
      description: groupData.description ?? null,
      expires_at: groupData.expires_at ?? null,
      is_active: true,
    })
    .select()
    .single()

  if (groupError) {
    console.error('[createStudyGroup] group creation failed:', groupError.message)
    return { data: null, error: groupError.message }
  }

  // step 2: add the host to the members junction table
  const { error: memberError } = await supabase
    .from('study_group_members')
    .insert({
      group_id: (group as StudyGroup).id,
      user_id: groupData.host_id,
    })

  if (memberError) {
    // something went wrong adding the host, clean up the group row so we dont leave orphans
    console.error('[createStudyGroup] adding host as member failed:', memberError.message)
    await supabase.from('study_groups').delete().eq('id', (group as StudyGroup).id)
    return { data: null, error: memberError.message }
  }

  return { data: group as StudyGroup, error: null }
}

// ─── JOIN STUDY GROUP ─────────────────────────────────────────────────────────

/**
 * Adds a student to an existing study group.
 * Also bumps up current_members by 1.
 *
 * Does a capacity check first before inserting.
 * The unique constraint on (group_id, user_id) will catch double-joins
 * at the DB level too, so we handle that error as well.
 *
 * @param groupId - the group to join
 * @param userId  - the student who wants in
 */
export async function joinStudyGroup(
  supabase: SupabaseClient,
  groupId: number,
  userId: string,
): Promise<DbResult<StudyGroupMember>> {
  // check if there's still space in the group
  const { data: group, error: fetchError } = await supabase
    .from('study_groups')
    .select('current_members, max_members, is_active')
    .eq('id', groupId)
    .single()

  if (fetchError || !group) {
    return { data: null, error: fetchError?.message ?? 'Group not found' }
  }

  if (!group.is_active) {
    return { data: null, error: 'This study group is no longer active.' }
  }

  if (group.current_members >= group.max_members) {
    return { data: null, error: 'This study group is full.' }
  }

  // actually insert the member row
  const { data: member, error: joinError } = await supabase
    .from('study_group_members')
    .insert({ group_id: groupId, user_id: userId })
    .select()
    .single()

  if (joinError) {
    // unique constraint violation means they're already in the group
    console.error(`[joinStudyGroup] groupId=${groupId} userId=${userId}`, joinError.message)
    return { data: null, error: 'You are already in this group.' }
  }

  // update the member count on the parent group row
  await supabase
    .from('study_groups')
    .update({ current_members: group.current_members + 1 })
    .eq('id', groupId)

  return { data: member as StudyGroupMember, error: null }
}

// ─── LEAVE STUDY GROUP ────────────────────────────────────────────────────────

/**
 * Removes a student from a study group and decrements current_members.
 *
 * Special case: if the person leaving is the host, we mark the whole group
 * as inactive instead of just removing them. No group without a host.
 *
 * @param groupId - the group to leave
 * @param userId  - the student who wants to leave
 */
export async function leaveStudyGroup(
  supabase: SupabaseClient,
  groupId: number,
  userId: string,
): Promise<DbResult<null>> {
  // grab the group first so we know if this person is the host
  const { data: group, error: fetchError } = await supabase
    .from('study_groups')
    .select('host_id, current_members')
    .eq('id', groupId)
    .single()

  if (fetchError || !group) {
    return { data: null, error: fetchError?.message ?? 'Group not found' }
  }

  // delete their row from the junction table
  const { error: removeError } = await supabase
    .from('study_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)

  if (removeError) {
    console.error(`[leaveStudyGroup] groupId=${groupId} userId=${userId}`, removeError.message)
    return { data: null, error: removeError.message }
  }

  if (group.host_id === userId) {
    // host left so the whole group gets disbanded (soft delete, keeps history)
    await supabase
      .from('study_groups')
      .update({ is_active: false })
      .eq('id', groupId)
  } else {
    // normal member left, just decrement the count
    // Math.max(0, ...) so it never goes negative
    await supabase
      .from('study_groups')
      .update({ current_members: Math.max(0, group.current_members - 1) })
      .eq('id', groupId)
  }

  return { data: null, error: null }
}
