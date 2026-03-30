// Database queries for the Study Buddy feature (study_groups + study_group_members tables).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DbResult, StudyGroup, StudyGroupMember } from '@/lib/types/database'

// ─── GET ACTIVE STUDY GROUPS AT A LOCATION ───────────────────────────────────

/** Active groups at a location — used on the location detail tab. */
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
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error(`[getStudyGroupsAtLocation] locationId=${locationId}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: data as StudyGroup[], error: null }
}

// ─── FILTER STUDY GROUPS BY MODULE ────────────────────────────────────────────

/** Active groups filtered by subject (case-insensitive partial match). */
export async function getStudyGroupsByModule(
  supabase: SupabaseClient,
  module: string,
): Promise<DbResult<StudyGroup[]>> {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('study_groups')
    .select('*')
    .eq('is_active', true)
    .ilike('subject', `%${module}%`)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error(`[getStudyGroupsByModule] module=${module}`, error.message)
    return { data: null, error: error.message }
  }

  return { data: data as StudyGroup[], error: null }
}

// ─── GET STUDY GROUP MEMBERS ──────────────────────────────────────────────────

/** Members of a group, ordered by join time. */
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

export type CreateStudyGroupData = {
  host_id: string
  location_id: number
  subject: string
  max_members?: number    // defaults to 5
  description?: string
  expires_at?: string     // ISO datetime
}

/**
 * Creates a study group and immediately adds the host as the first member.
 * If adding the host fails, the group is deleted to avoid orphaned records.
 */
export async function createStudyGroup(
  supabase: SupabaseClient,
  groupData: CreateStudyGroupData,
): Promise<DbResult<StudyGroup>> {
  const { data: group, error: groupError } = await supabase
    .from('study_groups')
    .insert({
      host_id:         groupData.host_id,
      location_id:     groupData.location_id,
      subject:         groupData.subject,
      max_members:     groupData.max_members ?? 5,
      current_members: 1,
      description:     groupData.description ?? null,
      expires_at:      groupData.expires_at ?? null,
      is_active:       true,
    })
    .select()
    .single()

  if (groupError) {
    console.error('[createStudyGroup] Group creation failed:', groupError.message)
    return { data: null, error: groupError.message }
  }

  const { error: memberError } = await supabase
    .from('study_group_members')
    .insert({ group_id: (group as StudyGroup).id, user_id: groupData.host_id })

  if (memberError) {
    console.error('[createStudyGroup] Adding host as member failed:', memberError.message)
    await supabase.from('study_groups').delete().eq('id', (group as StudyGroup).id)
    return { data: null, error: memberError.message }
  }

  return { data: group as StudyGroup, error: null }
}

// ─── JOIN STUDY GROUP ─────────────────────────────────────────────────────────

/**
 * Adds a student to a study group and increments current_members.
 * Returns an error if the group is inactive, full, or the user is already a member.
 */
export async function joinStudyGroup(
  supabase: SupabaseClient,
  groupId: number,
  userId: string,
): Promise<DbResult<StudyGroupMember>> {
  const { data: group, error: fetchError } = await supabase
    .from('study_groups')
    .select('max_members, is_active')
    .eq('id', groupId)
    .single()

  if (fetchError || !group) {
    return { data: null, error: fetchError?.message ?? 'Group not found' }
  }
  if (!group.is_active) {
    return { data: null, error: 'This study group is no longer active.' }
  }

  // Count actual members to avoid race-condition over-fills
  const { count: actualCount } = await supabase
    .from('study_group_members')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', groupId)

  if ((actualCount ?? 0) >= group.max_members) {
    return { data: null, error: 'This study group is full.' }
  }

  const { data: member, error: joinError } = await supabase
    .from('study_group_members')
    .insert({ group_id: groupId, user_id: userId })
    .select()
    .single()

  if (joinError) {
    console.error(`[joinStudyGroup] groupId=${groupId} userId=${userId}`, joinError.message)
    return { data: null, error: 'You are already in this group.' }
  }

  // Sync counter via SECURITY DEFINER RPC so RLS doesn't block the update
  await supabase.rpc('sync_group_member_count', { p_group_id: groupId })

  return { data: member as StudyGroupMember, error: null }
}

// ─── LEAVE STUDY GROUP ────────────────────────────────────────────────────────

/**
 * Removes a student from a study group.
 * If the host leaves, the entire group is disbanded (is_active → false).
 * Otherwise just decrements current_members.
 */
export async function leaveStudyGroup(
  supabase: SupabaseClient,
  groupId: number,
  userId: string,
): Promise<DbResult<null>> {
  const { data: group, error: fetchError } = await supabase
    .from('study_groups')
    .select('host_id, current_members')
    .eq('id', groupId)
    .single()

  if (fetchError || !group) {
    return { data: null, error: fetchError?.message ?? 'Group not found' }
  }

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
    // Host leaving disbands the group — no need to count members
    await supabase.from('study_groups').update({ is_active: false, current_members: 0 }).eq('id', groupId)
  } else {
    // Sync counter via SECURITY DEFINER RPC so RLS doesn't block the update
    await supabase.rpc('sync_group_member_count', { p_group_id: groupId })
  }

  return { data: null, error: null }
}
