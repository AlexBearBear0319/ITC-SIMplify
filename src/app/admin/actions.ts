"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

// ── Guard: caller must be an authenticated admin ──────────────────────────────

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data } = await supabase
    .from("profiles").select("is_admin").eq("id", user.id).single();
  if (!data?.is_admin) throw new Error("Not authorised");
}

type R = { error: string | null };

// ── Events ────────────────────────────────────────────────────────────────────

export async function adminSaveEvent(
  payload: { title: string; description: string | null; event_date: string; location_id: number | null; is_peak_alert: boolean },
  editingId?: number,
): Promise<R> {
  await requireAdmin();
  const db = createAdminClient();
  const { error } = editingId
    ? await db.from("events").update(payload).eq("id", editingId)
    : await db.from("events").insert(payload);
  return { error: error?.message ?? null };
}

export async function adminDeleteEvent(id: number): Promise<R> {
  await requireAdmin();
  const { error } = await createAdminClient().from("events").delete().eq("id", id);
  return { error: error?.message ?? null };
}

// ── Rewards ───────────────────────────────────────────────────────────────────

export async function adminSaveReward(
  payload: { name: string; description: string | null; cost: number; stock: number | null; is_active: boolean; image_url: string | null },
  editingId?: number,
): Promise<R> {
  await requireAdmin();
  const db = createAdminClient();
  const { error } = editingId
    ? await db.from("redemption_items").update(payload).eq("id", editingId)
    : await db.from("redemption_items").insert(payload);
  return { error: error?.message ?? null };
}

export async function adminDeleteReward(id: number): Promise<R> {
  await requireAdmin();
  const { error } = await createAdminClient().from("redemption_items").delete().eq("id", id);
  return { error: error?.message ?? null };
}

export async function adminToggleReward(id: number, isActive: boolean): Promise<R> {
  await requireAdmin();
  const { error } = await createAdminClient()
    .from("redemption_items").update({ is_active: isActive }).eq("id", id);
  return { error: error?.message ?? null };
}

export async function adminAdjustStock(id: number, stock: number): Promise<R> {
  await requireAdmin();
  const { error } = await createAdminClient()
    .from("redemption_items").update({ stock }).eq("id", id);
  return { error: error?.message ?? null };
}

// ── Users ─────────────────────────────────────────────────────────────────────

export async function adminToggleAdmin(userId: string, isAdmin: boolean): Promise<R> {
  await requireAdmin();
  const { error } = await createAdminClient()
    .from("profiles").update({ is_admin: isAdmin }).eq("id", userId);
  return { error: error?.message ?? null };
}

export async function adminUpdatePoints(userId: string, points: number): Promise<R> {
  await requireAdmin();
  const { error } = await createAdminClient()
    .from("profiles").update({ points }).eq("id", userId);
  return { error: error?.message ?? null };
}

// ── Locations ─────────────────────────────────────────────────────────────────

export async function adminSaveLocation(
  payload: Record<string, unknown>,
  editingId?: number,
): Promise<R> {
  await requireAdmin();
  const db = createAdminClient();
  const { error } = editingId
    ? await db.from("locations").update(payload).eq("id", editingId)
    : await db.from("locations").insert(payload);
  return { error: error?.message ?? null };
}

export async function adminDeleteLocation(id: number): Promise<R> {
  await requireAdmin();
  const { error } = await createAdminClient().from("locations").delete().eq("id", id);
  return { error: error?.message ?? null };
}

export async function adminUpdateLocationStatus(id: number, status: string): Promise<R> {
  await requireAdmin();
  const { error } = await createAdminClient()
    .from("locations").update({ current_status: status }).eq("id", id);
  return { error: error?.message ?? null };
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export async function adminDeleteReview(id: number): Promise<R> {
  await requireAdmin();
  const { error } = await createAdminClient().from("reviews").delete().eq("id", id);
  return { error: error?.message ?? null };
}

// ── Point Rules ───────────────────────────────────────────────────────────────

export async function adminUpdateRule(
  id: number,
  payload: { points_awarded: number | null; cooldown_minutes: number | null },
): Promise<R> {
  await requireAdmin();
  const { error } = await createAdminClient()
    .from("point_rules").update(payload).eq("id", id);
  return { error: error?.message ?? null };
}

export async function adminToggleRule(id: number, isActive: boolean): Promise<R> {
  await requireAdmin();
  const { error } = await createAdminClient()
    .from("point_rules").update({ is_active: isActive }).eq("id", id);
  return { error: error?.message ?? null };
}

// ── Schools ────────────────────────────────────────────────────────────────────

export async function adminSaveSchool(
  payload: { name: string; abbr: string },
  editingId?: number,
): Promise<R> {
  await requireAdmin();
  const db = createAdminClient();
  const { error } = editingId
    ? await db.from("schools").update(payload).eq("id", editingId)
    : await db.from("schools").insert(payload);
  return { error: error?.message ?? null };
}

export async function adminDeleteSchool(id: number): Promise<R> {
  await requireAdmin();
  const { error } = await createAdminClient().from("schools").delete().eq("id", id);
  return { error: error?.message ?? null };
}

// ── Majors ─────────────────────────────────────────────────────────────────────

export async function adminSaveMajor(
  payload: { name: string; education_level: string; school_id: number },
  editingId?: number,
): Promise<R> {
  await requireAdmin();
  const db = createAdminClient();
  const { error } = editingId
    ? await db.from("majors").update(payload).eq("id", editingId)
    : await db.from("majors").insert(payload);
  return { error: error?.message ?? null };
}

export async function adminDeleteMajor(id: number): Promise<R> {
  await requireAdmin();
  const { error } = await createAdminClient().from("majors").delete().eq("id", id);
  return { error: error?.message ?? null };
}

// ── Subjects ───────────────────────────────────────────────────────────────────

export async function adminSaveSubject(
  payload: { name: string; course_code: string | null; major_id: number },
  editingId?: number,
): Promise<R> {
  await requireAdmin();
  const db = createAdminClient();
  const { error } = editingId
    ? await db.from("subjects").update(payload).eq("id", editingId)
    : await db.from("subjects").insert(payload);
  return { error: error?.message ?? null };
}

export async function adminDeleteSubject(id: number): Promise<R> {
  await requireAdmin();
  const { error } = await createAdminClient().from("subjects").delete().eq("id", id);
  return { error: error?.message ?? null };
}
