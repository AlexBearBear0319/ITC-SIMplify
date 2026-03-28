"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

// ── Guard: caller must be an authenticated admin ──────────────────────────────
// Returns an error string if the check fails, null if OK.

async function requireAdmin(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "Not authenticated";
    const { data } = await supabase
      .from("profiles").select("is_admin").eq("id", user.id).single();
    if (!data?.is_admin) return "Not authorised";
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Authentication check failed";
  }
}

type R = { error: string | null };

// ── Storage ───────────────────────────────────────────────────────────────────

const BUCKET = "location-images";

export async function adminUploadLocationImage(
  formData: FormData,
): Promise<{ url: string | null; error: string | null }> {
  const authErr = await requireAdmin();
  if (authErr) return { url: null, error: authErr };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { url: null, error: "No file provided" };

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) return { url: null, error: "Only JPG, PNG, WEBP or GIF allowed" };
  if (file.size > 5 * 1024 * 1024) return { url: null, error: "File must be under 5 MB" };

  try {
    const db = createAdminClient();

    // Create bucket if it doesn't exist yet
    const { data: buckets } = await db.storage.listBuckets();
    if (!buckets?.find((b) => b.name === BUCKET)) {
      await db.storage.createBucket(BUCKET, { public: true });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const bytes = await file.arrayBuffer();
    const { error } = await db.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: false });

    if (error) return { url: null, error: error.message };

    const { data: { publicUrl } } = db.storage.from(BUCKET).getPublicUrl(path);
    return { url: publicUrl, error: null };
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : "Upload failed" };
  }
}

export async function adminDeleteLocationImage(path: string): Promise<{ error: string | null }> {
  const authErr = await requireAdmin();
  if (authErr) return { error: authErr };
  try {
    const { error } = await createAdminClient().storage.from(BUCKET).remove([path]);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Delete failed" };
  }
}

// ── Events ────────────────────────────────────────────────────────────────────

export async function adminSaveEvent(
  payload: { title: string; description: string | null; event_date: string; location_id: number | null; is_peak_alert: boolean },
  editingId?: number,
): Promise<R> {
  const authErr = await requireAdmin();
  if (authErr) return { error: authErr };
  try {
    const db = createAdminClient();
    const { error } = editingId
      ? await db.from("events").update(payload).eq("id", editingId)
      : await db.from("events").insert(payload);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

export async function adminDeleteEvent(id: number): Promise<R> {
  const authErr = await requireAdmin();
  if (authErr) return { error: authErr };
  try {
    const { error } = await createAdminClient().from("events").delete().eq("id", id);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

// ── Rewards ───────────────────────────────────────────────────────────────────

export async function adminSaveReward(
  payload: { name: string; description: string | null; cost: number; stock: number | null; is_active: boolean; image_url: string | null },
  editingId?: number,
): Promise<R> {
  const authErr = await requireAdmin();
  if (authErr) return { error: authErr };
  try {
    const db = createAdminClient();
    const { error } = editingId
      ? await db.from("redemption_items").update(payload).eq("id", editingId)
      : await db.from("redemption_items").insert(payload);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

export async function adminDeleteReward(id: number): Promise<R> {
  const authErr = await requireAdmin();
  if (authErr) return { error: authErr };
  try {
    const { error } = await createAdminClient().from("redemption_items").delete().eq("id", id);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

export async function adminToggleReward(id: number, isActive: boolean): Promise<R> {
  const authErr = await requireAdmin();
  if (authErr) return { error: authErr };
  try {
    const { error } = await createAdminClient()
      .from("redemption_items").update({ is_active: isActive }).eq("id", id);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

export async function adminAdjustStock(id: number, stock: number): Promise<R> {
  const authErr = await requireAdmin();
  if (authErr) return { error: authErr };
  try {
    const { error } = await createAdminClient()
      .from("redemption_items").update({ stock }).eq("id", id);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

// ── Users ─────────────────────────────────────────────────────────────────────

export async function adminToggleAdmin(userId: string, isAdmin: boolean): Promise<R> {
  const authErr = await requireAdmin();
  if (authErr) return { error: authErr };
  try {
    const { error } = await createAdminClient()
      .from("profiles").update({ is_admin: isAdmin }).eq("id", userId);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

export async function adminUpdatePoints(userId: string, points: number): Promise<R> {
  const authErr = await requireAdmin();
  if (authErr) return { error: authErr };
  try {
    const { error } = await createAdminClient()
      .from("profiles").update({ points }).eq("id", userId);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

// ── Locations ─────────────────────────────────────────────────────────────────

export async function adminSaveLocation(
  payload: Record<string, unknown>,
  editingId?: number,
): Promise<R> {
  const authErr = await requireAdmin();
  if (authErr) return { error: authErr };
  try {
    const db = createAdminClient();
    const { error } = editingId
      ? await db.from("locations").update(payload).eq("id", editingId)
      : await db.from("locations").insert(payload);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

export async function adminDeleteLocation(id: number): Promise<R> {
  const authErr = await requireAdmin();
  if (authErr) return { error: authErr };
  try {
    const { error } = await createAdminClient().from("locations").delete().eq("id", id);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

export async function adminUpdateLocationStatus(id: number, status: string): Promise<R> {
  const authErr = await requireAdmin();
  if (authErr) return { error: authErr };
  try {
    const { error } = await createAdminClient()
      .from("locations").update({ current_status: status }).eq("id", id);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export async function adminDeleteReview(id: number): Promise<R> {
  const authErr = await requireAdmin();
  if (authErr) return { error: authErr };
  try {
    const { error } = await createAdminClient().from("reviews").delete().eq("id", id);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

// ── Point Rules ───────────────────────────────────────────────────────────────

export async function adminUpdateRule(
  id: number,
  payload: { points_awarded: number | null; cooldown_minutes: number | null },
): Promise<R> {
  const authErr = await requireAdmin();
  if (authErr) return { error: authErr };
  try {
    const { error } = await createAdminClient()
      .from("point_rules").update(payload).eq("id", id);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

export async function adminToggleRule(id: number, isActive: boolean): Promise<R> {
  const authErr = await requireAdmin();
  if (authErr) return { error: authErr };
  try {
    const { error } = await createAdminClient()
      .from("point_rules").update({ is_active: isActive }).eq("id", id);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

// ── Schools ────────────────────────────────────────────────────────────────────

export async function adminSaveSchool(
  payload: { name: string; abbr: string },
  editingId?: number,
): Promise<R> {
  const authErr = await requireAdmin();
  if (authErr) return { error: authErr };
  try {
    const db = createAdminClient();
    const { error } = editingId
      ? await db.from("schools").update(payload).eq("id", editingId)
      : await db.from("schools").insert(payload);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

export async function adminDeleteSchool(id: number): Promise<R> {
  const authErr = await requireAdmin();
  if (authErr) return { error: authErr };
  try {
    const { error } = await createAdminClient().from("schools").delete().eq("id", id);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

// ── Majors ─────────────────────────────────────────────────────────────────────

export async function adminSaveMajor(
  payload: { name: string; education_level: string; school_id: number },
  editingId?: number,
): Promise<R> {
  const authErr = await requireAdmin();
  if (authErr) return { error: authErr };
  try {
    const db = createAdminClient();
    const { error } = editingId
      ? await db.from("majors").update(payload).eq("id", editingId)
      : await db.from("majors").insert(payload);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

export async function adminDeleteMajor(id: number): Promise<R> {
  const authErr = await requireAdmin();
  if (authErr) return { error: authErr };
  try {
    const { error } = await createAdminClient().from("majors").delete().eq("id", id);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

// ── Subjects ───────────────────────────────────────────────────────────────────

export async function adminSaveSubject(
  payload: { name: string; course_code: string | null; major_id: number },
  editingId?: number,
): Promise<R> {
  const authErr = await requireAdmin();
  if (authErr) return { error: authErr };
  try {
    const db = createAdminClient();
    const { error } = editingId
      ? await db.from("subjects").update(payload).eq("id", editingId)
      : await db.from("subjects").insert(payload);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

export async function adminDeleteSubject(id: number): Promise<R> {
  const authErr = await requireAdmin();
  if (authErr) return { error: authErr };
  try {
    const { error } = await createAdminClient().from("subjects").delete().eq("id", id);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error" };
  }
}
