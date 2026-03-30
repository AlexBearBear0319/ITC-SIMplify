"use server"

import { createClient } from "@/utils/supabase/server"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_BYTES = 1 * 1024 * 1024 // 1 MB

export async function uploadAvatar(
  formData: FormData,
): Promise<{ url: string | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { url: null, error: "Not authenticated" }

  const file = formData.get("avatar") as File
  if (!file || file.size === 0) return { url: null, error: "No file provided" }
  if (file.size > MAX_BYTES) return { url: null, error: "File must be under 1 MB" }
  if (!ALLOWED_TYPES.includes(file.type)) return { url: null, error: "Only JPEG, PNG, or WebP allowed" }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
  const path = `${user.id}/avatar.${ext}`
  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (uploadError) return { url: null, error: uploadError.message }

  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path)
  const url = `${publicUrl}?t=${Date.now()}`

  await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id)
  return { url, error: null }
}
