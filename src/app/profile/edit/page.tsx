"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { ArrowLeft, Camera, CheckCircle2, Loader2, Settings, XCircle } from "lucide-react";
import { uploadAvatar } from "../actions";

type EditForm = {
  full_name: string;
  username: string;
  age: string;
  school_id: number;
  major_id: number;
  education_level: string;
  semester_term: string;
};

type School = { id: number; name: string; abbr: string };
type Major = { id: number; name: string };
type SaveState = "idle" | "saving" | "saved" | "error";

const DEFAULT_PROFILE_ICON = "/profile_default.png";

const PRESET_PROFILE_ICONS = [
  "/profile_cool.png",
  "/profile_default.png",
  "/profile_excited.png",
  "/profile_happy.png",
  "/profile_smirk.png",
  "/profile_tired.png",
];

const FIELD_INPUT =
  "w-full px-4 py-3 rounded-xl border border-border bg-canvas text-ink text-sm placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand transition-shadow";
const FIELD_LABEL = "block text-sm font-medium text-ink mb-2";

export default function EditProfilePage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [majors, setMajors] = useState<Major[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    full_name: "",
    username: "",
    age: "",
    school_id: 0,
    major_id: 0,
    education_level: "",
    semester_term: "",
  });

  const setEdit = <K extends keyof EditForm>(k: K, v: EditForm[K]) =>
    setEditForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        window.location.href = "/auth/login";
        return;
      }

      const [profileResult, schoolsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url, age, school_id, major_id, education_level, semester_term")
          .eq("id", user.id)
          .single(),
        supabase
          .from("schools")
          .select("id, name, abbr")
          .order("name"),
      ]);

      const prof = profileResult.data;

      if (schoolsResult.error) {
        // Fallback for schemas that don't have "abbr" yet.
        const fallback = await supabase
          .from("schools")
          .select("id, name")
          .order("name");

        if (fallback.data && fallback.data.length > 0) {
          setSchools(
            fallback.data.map((s: { id: number; name: string }) => ({
              id: s.id,
              name: s.name,
              abbr: "",
            }))
          );
          setMetaError(null);
        } else {
          setSchools([]);
          setMetaError(
            "School list is not visible to your user role. Ask admin to add a SELECT policy for schools.",
          );
        }
      } else {
        const rows = (schoolsResult.data ?? []) as School[];
        setSchools(rows);
        setMetaError(
          rows.length === 0
            ? "No schools are visible for your login. If schools exist in DB, this is likely an RLS policy issue."
            : null
        );
      }

      if (prof) {
        setProfileId(prof.id);
        setEmail(user.email ?? "");
        setAvatarUrl(prof.avatar_url ?? DEFAULT_PROFILE_ICON);
        setEditForm({
          full_name: prof.full_name ?? "",
          username: prof.username ?? "",
          age: prof.age != null ? String(prof.age) : "",
          school_id: prof.school_id ?? 0,
          major_id: prof.major_id ?? 0,
          education_level: prof.education_level ?? "",
          semester_term: prof.semester_term ?? "",
        });
      }

      setLoading(false);
    });
  }, [supabase]);

  useEffect(() => {
    if (editForm.school_id === 0) {
      setMajors([]);
      return;
    }

    supabase
      .from("majors")
      .select("id, name")
      .eq("school_id", editForm.school_id)
      .order("name")
      .then(({ data }) => {
        if (data) setMajors(data);
      });
  }, [editForm.school_id, supabase]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1 * 1024 * 1024) {
      setSaveError("File must be under 1 MB");
      setSaveState("error");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setSaveError("Only JPEG, PNG, or WebP allowed");
      setSaveState("error");
      return;
    }

    setAvatarPreview(URL.createObjectURL(file));
    setAvatarUploading(true);
    setSaveError(null);

    const formData = new FormData();
    formData.append("avatar", file);
    const { url, error } = await uploadAvatar(formData);

    setAvatarUploading(false);
    if (error || !url) {
      setAvatarPreview(null);
      setSaveError(error ?? "Upload failed");
      setSaveState("error");
      return;
    }

    setAvatarUrl(url);
    setAvatarPreview(null);
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 2000);
  }

  async function handlePickPresetAvatar(nextUrl: string) {
    if (!profileId) return;

    setSaveState("saving");
    setSaveError(null);

    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: nextUrl })
      .eq("id", profileId);

    if (error) {
      setSaveState("error");
      setSaveError(error.message);
      return;
    }

    setAvatarUrl(nextUrl);
    window.dispatchEvent(new Event("profile-updated"));
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 2000);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profileId) return;

    setSaveState("saving");
    setSaveError(null);

    const updatedFields = {
      full_name: editForm.full_name.trim(),
      username: editForm.username.trim(),
      avatar_url: avatarUrl ?? DEFAULT_PROFILE_ICON,
      age: editForm.age ? Number(editForm.age) : null,
      school_id: editForm.school_id || null,
      major_id: editForm.major_id || null,
      education_level: editForm.education_level || null,
      semester_term: editForm.semester_term.trim() || null,
    };

    const { error } = await supabase
      .from("profiles")
      .update(updatedFields)
      .eq("id", profileId);

    if (error) {
      setSaveState("error");
      setSaveError(error.message);
      return;
    }

    window.dispatchEvent(new Event("profile-updated"));
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 2500);
  }

  if (loading) {
    return (
      <div className="min-h-full bg-canvas px-5 pt-8 pb-20 sm:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="h-[520px] rounded-2xl bg-surface border border-border animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-canvas px-5 pt-8 pb-20 sm:px-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Profile
        </Link>

        <section className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Settings size={16} className="text-ink-muted" />
            <h1 className="font-semibold text-ink">Edit Profile</h1>
          </div>

          <form onSubmit={handleSaveProfile} className="p-5 space-y-4">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />

            <div className="rounded-2xl border border-border bg-canvas/50 p-4">
              <p className="text-sm font-semibold text-ink mb-3">Profile Icon</p>
              <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4 items-start">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative w-28 h-28 rounded-2xl overflow-hidden border border-border bg-surface">
                    {avatarPreview || avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarPreview ?? avatarUrl!}
                        alt="Selected profile icon"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={DEFAULT_PROFILE_ICON}
                        alt="Default profile icon"
                        className="w-full h-full object-cover"
                      />
                    )}

                    {avatarUploading && (
                      <div className="absolute inset-0 bg-black/40 grid place-items-center">
                        <Loader2 size={20} className="text-white animate-spin" />
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium border border-border text-ink-muted hover:text-ink hover:bg-surface transition-colors"
                  >
                    <Camera size={13} />
                    Upload your own
                  </button>
                </div>

                <div>
                  <p className="text-xs text-ink-muted mb-2">Choose from preset icons:</p>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {PRESET_PROFILE_ICONS.map((iconPath) => {
                      const selected = avatarUrl === iconPath;
                      return (
                        <button
                          key={iconPath}
                          type="button"
                          onClick={() => handlePickPresetAvatar(iconPath)}
                          className={`relative rounded-xl border p-2 bg-surface transition-all ${
                            selected
                              ? "border-brand ring-2 ring-brand/30"
                              : "border-border hover:border-brand/50"
                          }`}
                          aria-label={`Select ${iconPath.replace("/profile_", "").replace(/\.(svg|png)$/i, "")} avatar`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={iconPath}
                            alt={iconPath}
                            className="w-full aspect-square object-contain"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={FIELD_LABEL}>Email</label>
                <div className={`${FIELD_INPUT} bg-canvas/50 text-ink-muted cursor-not-allowed select-none`}>
                  {email}
                </div>
                <p className="mt-1 text-xs text-ink-faint">
                  To change your email, go to{" "}
                  <Link href="/settings" className="underline hover:text-ink">Settings</Link>.
                </p>
              </div>

              <div>
                <label className={FIELD_LABEL}>Full Name</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEdit("full_name", e.target.value)}
                  required
                  className={FIELD_INPUT}
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label className={FIELD_LABEL}>Username</label>
                <input
                  type="text"
                  value={editForm.username}
                  onChange={(e) => setEdit("username", e.target.value)}
                  required
                  className={FIELD_INPUT}
                  placeholder="your_username"
                />
              </div>

              <div>
                <label className={FIELD_LABEL}>Age</label>
                <input
                  type="number"
                  min={16}
                  max={100}
                  value={editForm.age}
                  onChange={(e) => setEdit("age", e.target.value)}
                  className={FIELD_INPUT}
                  placeholder="e.g. 21"
                />
              </div>

              <div>
                <label className={FIELD_LABEL}>Education Level</label>
                <select
                  value={editForm.education_level}
                  onChange={(e) => setEdit("education_level", e.target.value)}
                  className={`${FIELD_INPUT} appearance-none cursor-pointer pr-8`}
                >
                  <option value="">Select...</option>
                  <option value="Diploma">Diploma</option>
                  <option value="Undergraduate">Undergraduate</option>
                  <option value="Postgraduate">Postgraduate</option>
                </select>
              </div>

              <div>
                <label className={FIELD_LABEL}>School</label>
                <select
                  value={editForm.school_id}
                  onChange={(e) => {
                    setEdit("school_id", Number(e.target.value));
                    setEdit("major_id", 0);
                  }}
                  disabled={schools.length === 0}
                  className={`${FIELD_INPUT} appearance-none cursor-pointer pr-8`}
                >
                  <option value={0}>Select school...</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.abbr ? `${s.abbr} - ${s.name}` : s.name}
                    </option>
                  ))}
                </select>
                {schools.length === 0 && (
                  <p className="mt-1 text-xs text-alert">
                    {metaError ?? "No schools available yet. Please ask admin to add schools."}
                  </p>
                )}
              </div>

              <div>
                <label className={FIELD_LABEL}>Major</label>
                <select
                  value={editForm.major_id}
                  onChange={(e) => setEdit("major_id", Number(e.target.value))}
                  disabled={editForm.school_id === 0 || majors.length === 0}
                  className={`${FIELD_INPUT} appearance-none cursor-pointer pr-8 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <option value={0}>
                    {editForm.school_id === 0 ? "Select school first..." : "Select major..."}
                  </option>
                  {majors.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className={FIELD_LABEL}>Semester / Term</label>
                <input
                  type="text"
                  value={editForm.semester_term}
                  onChange={(e) => setEdit("semester_term", e.target.value)}
                  className={FIELD_INPUT}
                  placeholder="e.g. Autumn 2025, Trimester 1"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={saveState === "saving"}
                className="px-5 py-3 rounded-full bg-ink text-surface text-sm font-medium hover:bg-ink/80 active:scale-95 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saveState === "saving" ? "Saving..." : "Save Profile"}
              </button>

              {saveState === "saved" && (
                <div className="flex items-center gap-2 text-success text-sm">
                  <CheckCircle2 size={15} />
                  <span>Saved!</span>
                </div>
              )}
              {saveState === "error" && (
                <div className="flex items-center gap-2 text-alert text-sm">
                  <XCircle size={15} />
                  <span>{saveError ?? "Failed to save."}</span>
                </div>
              )}
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
