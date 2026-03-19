// ============================================================
// DATABASE QUERIES: STUDY GROUPS (Study Buddy Feature)
// ============================================================
// Functions for creating and joining study groups.
//
// HOW THE FEATURE WORKS:
//   1. Student checks in to a location
//   2. They can create a Study Group (e.g., "CS101 — Final Exam Prep")
//   3. Other students at the same location see the group
//   4. They can join the group if there are open spots
//   5. Students can filter by module to find relevant groups
//
// STUDY BUDDY vs STUDY GROUP:
//   - "Study Buddy" mode is per-session (shown in sessions.ts)
//   - "Study Group" is a named, joinable group (this file)
//   Both work together to help students connect.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DbResult, StudyGroup, StudyGroupMember } from '@/lib/types/database'

// ─── GET ACTIVE STUDY GROUPS AT A LOCATION ───────────────────────────────────

/**
 * Fetches all currently active study groups at a specific location.
 * Use this to show students who else is at the spot and what they're studying.
 *
 * @param locationId - The location to search
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
    .or(`expires_at.is.null,expires_at.gt.${now}`)  // Not expired yet
    .order('created_at', { ascending: false })

  if (error) {
    console.error(`[getStudyGroupsAtLocation] locationId=${locationId}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: data as StudyGroup[], error: null }
}

// ─── FILTER STUDY GROUPS BY MODULE ────────────────────────────────────────────

/**
 * Fetches active study groups studying a specific module/subject.
 * Students can use this to find people studying the same thing,
 * even across different locations.
 *
 * @param module - The subject to filter by, e.g., "CS101", "MAT201"
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
    .ilike('subject', `%${module}%`)  // Case-insensitive partial match
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
 * Fetches the list of students in a study group.
 * Use this to show who is in the group on the group detail screen.
 *
 * @param groupId - The study group's ID
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
 * Data needed to create a new study group.
 */
export type CreateStudyGroupData = {
  host_id: string         // The student creating the group
  location_id: number     // Where the group is meeting
  subject: string         // What they're studying, e.g., "CS101 Finals"
  max_members?: number    // Max group size (default: 5)
  description?: string    // Extra info about what topics they're covering
  expires_at?: string     // ISO datetime — when the session ends (optional)
}

/**
 * Creates a new study group and automatically adds the host as the first member.
 * After calling this, the group will appear in getStudyGroupsAtLocation().
 *
 * @param groupData - Details about the group to create (see CreateStudyGroupData)
 */
export async function createStudyGroup(
  supabase: SupabaseClient,
  groupData: CreateStudyGroupData,
): Promise<DbResult<StudyGroup>> {
  // Step 1: Create the study group record
  const { data: group, error: groupError } = await supabase
    .from('study_groups')
    .insert({
      host_id: groupData.host_id,
      location_id: groupData.location_id,
      subject: groupData.subject,
      max_members: groupData.max_members ?? 5,
      current_members: 1,                          // Host counts as first member
      description: groupData.description ?? null,
      expires_at: groupData.expires_at ?? null,
      is_active: true,
    })
    .select()
    .single()

  if (groupError) {
    console.error('[createStudyGroup] Group creation failed:', groupError.message)
    return { data: null, error: groupError.message }
  }

  // Step 2: Add the host as the first member
  const { error: memberError } = await supabase
    .from('study_group_members')
    .insert({
      group_id: (group as StudyGroup).id,
      user_id: groupData.host_id,
    })

  if (memberError) {
    // If adding the host fails, clean up the group to avoid orphaned records
    console.error('[createStudyGroup] Adding host as member failed:', memberError.message)
    await supabase.from('study_groups').delete().eq('id', (group as StudyGroup).id)
    return { data: null, error: memberError.message }
  }

  return { data: group as StudyGroup, error: null }
}

// ─── JOIN STUDY GROUP ─────────────────────────────────────────────────────────

/**
 * Adds a student to an existing study group.
 * Automatically increments the current_members count.
 * Fails if the group is full (current_members >= max_members).
 *
 * @param groupId - The group to join
 * @param userId  - The student who wants to join
 */
export async function joinStudyGroup(
  supabase: SupabaseClient,
  groupId: number,
  userId: string,
): Promise<DbResult<StudyGroupMember>> {
  // Step 1: Check if the group has space
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

  // Step 2: Add the student to study_group_members
  const { data: member, error: joinError } = await supabase
    .from('study_group_members')
    .insert({ group_id: groupId, user_id: userId })
    .select()
    .single()

  if (joinError) {
    // The unique constraint will cause an error if they're already in the group
    console.error(`[joinStudyGroup] groupId=${groupId} userId=${userId}`, joinError.message)
    return { data: null, error: 'You are already in this group.' }
  }

  // Step 3: Increment the member count on the group
  await supabase
    .from('study_groups')
    .update({ current_members: group.current_members + 1 })
    .eq('id', groupId)

  return { data: member as StudyGroupMember, error: null }
}

// ─── LEAVE STUDY GROUP ────────────────────────────────────────────────────────

/**
 * Removes a student from a study group.
 * Automatically decrements the current_members count.
 * If the host leaves, the group is marked as inactive.
 *
 * @param groupId - The group to leave
 * @param userId  - The student who wants to leave
 */
export async function leaveStudyGroup(
  supabase: SupabaseClient,
  groupId: number,
  userId: string,
): Promise<DbResult<null>> {
  // Step 1: Get current group state
  const { data: group, error: fetchError } = await supabase
    .from('study_groups')
    .select('host_id, current_members')
    .eq('id', groupId)
    .single()

  if (fetchError || !group) {
    return { data: null, error: fetchError?.message ?? 'Group not found' }
  }

  // Step 2: Remove the student from study_group_members
  const { error: removeError } = await supabase
    .from('study_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)

  if (removeError) {
    console.error(`[leaveStudyGroup] groupId=${groupId} userId=${userId}`, removeError.message)
    return { data: null, error: removeError.message }
  }

  // Step 3: If the host is leaving, disband the whole group
  if (group.host_id === userId) {
    await supabase
      .from('study_groups')
      .update({ is_active: false })
      .eq('id', groupId)
  } else {
    // Otherwise just decrement the member count
    await supabase
      .from('study_groups')
      .update({ current_members: Math.max(0, group.current_members - 1) })
      .eq('id', groupId)
  }

  return { data: null, error: null }
}
