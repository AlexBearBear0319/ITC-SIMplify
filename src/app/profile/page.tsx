"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { getLevel } from "@/lib/levels";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import {
  MapPin,
  Users,
  CalendarDays,
  Coins,
  Flame,
  BookOpen,
  Trophy,
  Star,
  Lock,
  Crown,
  Gift,
  Settings,
  CheckCircle2,
  XCircle,
  Camera,
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { uploadAvatar } from "./actions";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
  points: number;
  streak_days: number;
  total_checkins: number;
  joined_at: string;
  age: number | null;
  school_id: number | null;
  major_id: number | null;
  education_level: string | null;
  semester_term: string | null;
};

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
type Major  = { id: number; name: string };

type AchievementRarity = "common" | "rare" | "epic";

type Achievement = {
  id: number;
  icon: LucideIcon;
  name: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: string;
  rarity: AchievementRarity;
  progress?: string;
};

type ActivityType = "checkin" | "redemption" | "group" | "event" | "badge";

type ActivityItem = {
  id: number;
  type: ActivityType;
  description: string;
  time: string;
};

// ─────────────────────────────────────────────
// Config maps
// ─────────────────────────────────────────────

const RARITY_CONFIG: Record<AchievementRarity, { bg: string; iconClass: string; label: string }> = {
  common: { bg: "bg-brand-faint",  iconClass: "text-brand-dark", label: "Common" },
  rare:   { bg: "bg-gold-light",   iconClass: "text-gold",       label: "Rare"   },
  epic:   { bg: "bg-alert-light",  iconClass: "text-alert",      label: "Epic"   },
};

const ACTIVITY_CONFIG: Record<ActivityType, { icon: LucideIcon; bg: string; iconClass: string }> = {
  checkin:    { icon: MapPin,       bg: "bg-brand-faint",   iconClass: "text-brand-dark" },
  redemption: { icon: Gift,         bg: "bg-gold-light",    iconClass: "text-gold"       },
  group:      { icon: Users,        bg: "bg-success-light", iconClass: "text-success"    },
  event:      { icon: CalendarDays, bg: "bg-alert-light",   iconClass: "text-alert"      },
  badge:      { icon: Trophy,       bg: "bg-brand-light",   iconClass: "text-brand-dark" },
};

const ICON_MAP: Record<string, LucideIcon> = {
  book_open:     BookOpen,
  map_pin:       MapPin,
  users:         Users,
  calendar_days: CalendarDays,
  coins:         Coins,
  flame:         Flame,
  star:          Star,
  trophy:        Trophy,
  crown:         Crown,
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

const FIELD_INPUT =
  "w-full px-4 py-2.5 rounded-xl border border-border bg-canvas text-ink text-sm placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand transition-shadow";
const FIELD_LABEL = "block text-sm font-medium text-ink mb-1.5";

// ─────────────────────────────────────────────
// CountUp
// ─────────────────────────────────────────────

function CountUp({
  to,
  suffix = "",
  duration = 1.2,
}: {
  to: number;
  suffix?: string;
  duration?: number;
}) {
  const count   = useMotionValue(0);
  const display = useTransform(count, (v) => `${Math.round(v).toLocaleString()}${suffix}`);

  useEffect(() => {
    const controls = animate(count, to, {
      duration,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    });
    return controls.stop;
  }, [count, to, duration]);

  return <motion.span>{display}</motion.span>;
}

// ─────────────────────────────────────────────
// Animation variants
// ─────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const cardVariants = {
  hidden:  { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved" | "error";

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);

  const [profile,      setProfile]      = useState<UserProfile | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [activity,     setActivity]     = useState<ActivityItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const prevPointsRef  = useRef<number | null>(null);
  const [pointsDelta,  setPointsDelta]  = useState<number | null>(null);

  // Edit form state
  const [editForm,        setEditForm]        = useState<EditForm>({
    full_name: "", username: "", age: "", school_id: 0, major_id: 0,
    education_level: "", semester_term: "",
  });
  const [schools,         setSchools]         = useState<School[]>([]);
  const [majors,          setMajors]          = useState<Major[]>([]);
  const [saveState,       setSaveState]       = useState<SaveState>("idle");
  const [saveError,       setSaveError]       = useState<string | null>(null);

  // Avatar upload
  const avatarInputRef                        = useRef<HTMLInputElement>(null);
  const [avatarPreview,   setAvatarPreview]   = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const setEdit = <K extends keyof EditForm>(k: K, v: EditForm[K]) =>
    setEditForm((f) => ({ ...f, [k]: v }));

  // ── Initial data load ──
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;

      const [
        { data: prof },
        { count },
        { data: allAchievements },
        { data: userAchievements },
        { data: activityData },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url, points, streak_days, age, school_id, major_id, education_level, semester_term")
          .eq("id", user.id)
          .single(),
        supabase
          .from("active_sessions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("achievements")
          .select("*")
          .order("id"),
        supabase
          .from("user_achievements")
          .select("achievement_id, unlocked_at")
          .eq("user_id", user.id),
        supabase
          .from("activity_log")
          .select("id, type, description, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      if (prof) {
        const pts    = prof.points      ?? 0;
        const streak = prof.streak_days ?? 0;

        const loaded: UserProfile = {
          ...prof,
          email:          user.email ?? "",
          full_name:      prof.full_name ?? "Unknown",
          username:       prof.username  ?? "unknown",
          points:         pts,
          streak_days:    streak,
          total_checkins: count ?? 0,
          joined_at:      user.created_at,
          age:            prof.age            ?? null,
          school_id:      prof.school_id      ?? null,
          major_id:       prof.major_id       ?? null,
          education_level: prof.education_level ?? null,
          semester_term:  prof.semester_term  ?? null,
        };
        setProfile(loaded);
        prevPointsRef.current = pts;

        // Initialise the edit form from loaded profile data
        setEditForm({
          full_name:       loaded.full_name,
          username:        loaded.username,
          age:             loaded.age != null ? String(loaded.age) : "",
          school_id:       loaded.school_id  ?? 0,
          major_id:        loaded.major_id   ?? 0,
          education_level: loaded.education_level ?? "",
          semester_term:   loaded.semester_term   ?? "",
        });

        const unlockedMap = new Map(
          (userAchievements ?? []).map((ua) => [ua.achievement_id, ua.unlocked_at])
        );

        const mapped: Achievement[] = (allAchievements ?? []).map((a) => {
          const unlockedAt = unlockedMap.get(a.id);
          const icon       = ICON_MAP[a.icon_key] ?? BookOpen;

          let progress: string | undefined;
          if (!unlockedAt && a.unlock_type && a.unlock_threshold) {
            if (a.unlock_type === "streak")
              progress = `${streak} / ${a.unlock_threshold} days`;
            else if (a.unlock_type === "points")
              progress = `${pts.toLocaleString()} / ${a.unlock_threshold.toLocaleString()} pts`;
            else if (a.unlock_type === "checkins")
              progress = `${count ?? 0} / ${a.unlock_threshold} check-ins`;
          }

          return {
            id:          a.id,
            icon,
            name:        a.name,
            description: a.description,
            rarity:      a.rarity as AchievementRarity,
            unlocked:    !!unlockedAt,
            unlockedAt:  unlockedAt
              ? new Date(unlockedAt).toLocaleDateString("en-SG", { month: "short", year: "numeric" })
              : undefined,
            progress,
          };
        });
        setAchievements(mapped);
      }

      setActivity(
        (activityData ?? []).map((a) => ({
          id:          a.id,
          type:        a.type as ActivityType,
          description: a.description,
          time:        timeAgo(a.created_at),
        }))
      );

      setLoading(false);
    });
  }, []);

  // ── Load schools on mount ──
  useEffect(() => {
    supabase
      .from("schools")
      .select("id, name, abbr")
      .order("name")
      .then(({ data }) => { if (data) setSchools(data); });
  }, []);

  // ── Reload majors whenever school changes ──
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
      .then(({ data }) => { if (data) setMajors(data); });
  }, [editForm.school_id]);

  // ── Re-fetch profile when the tab regains focus (handles cases where
  //    Supabase realtime is not yet enabled for the profiles table) ──
  useEffect(() => {
    if (!profile?.id) return;
    const handleVisibility = async () => {
      if (document.visibilityState !== "visible") return;
      const { data: fresh } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url, points, streak_days, age, school_id, major_id, education_level, semester_term")
        .eq("id", profile.id)
        .single();
      if (!fresh) return;
      const newPts = fresh.points ?? 0;
      const prev   = prevPointsRef.current;
      if (prev !== null && newPts > prev) {
        setPointsDelta(newPts - prev);
        setTimeout(() => setPointsDelta(null), 2500);
      }
      prevPointsRef.current = newPts;
      setProfile((p) =>
        p ? {
          ...p,
          points:          newPts,
          full_name:       fresh.full_name       ?? p.full_name,
          username:        fresh.username        ?? p.username,
          streak_days:     fresh.streak_days     ?? p.streak_days,
          age:             fresh.age             ?? null,
          school_id:       fresh.school_id       ?? null,
          major_id:        fresh.major_id        ?? null,
          education_level: fresh.education_level ?? null,
          semester_term:   fresh.semester_term   ?? null,
        } : p
      );
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [profile?.id, supabase]);

  // ── 10-second polling: catch points updates when realtime is unavailable ──
  useEffect(() => {
    if (!profile?.id) return;
    const poll = async () => {
      const dirty = (() => { try { return sessionStorage.getItem("simplify_points_dirty") === "1"; } catch { return false; } })();
      if (!dirty) return;
      try { sessionStorage.removeItem("simplify_points_dirty"); } catch { /* ignore */ }
      const { data: fresh } = await supabase
        .from("profiles")
        .select("points")
        .eq("id", profile.id)
        .single();
      if (!fresh) return;
      const newPts = fresh.points ?? 0;
      const prev   = prevPointsRef.current;
      if (prev !== null && newPts > prev) {
        setPointsDelta(newPts - prev);
        setTimeout(() => setPointsDelta(null), 2500);
      }
      prevPointsRef.current = newPts;
      setProfile((p) => p ? { ...p, points: newPts } : p);
    };
    const id = setInterval(poll, 10_000);
    return () => clearInterval(id);
  }, [profile?.id, supabase]);

  // ── Realtime: reflect point changes instantly ──
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel("profile-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${profile.id}` },
        (payload) => {
          const newPoints = (payload.new as { points: number }).points;
          const prev = prevPointsRef.current;
          if (prev !== null && newPoints > prev) {
            setPointsDelta(newPoints - prev);
            setTimeout(() => setPointsDelta(null), 2500);
          }
          prevPointsRef.current = newPoints;
          setProfile((p) => (p ? { ...p, points: newPoints } : p));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, supabase]);

  // ── Avatar upload ──
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1 * 1024 * 1024) {
      setSaveError("File must be under 1 MB"); setSaveState("error"); return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setSaveError("Only JPEG, PNG, or WebP allowed"); setSaveState("error"); return;
    }

    setAvatarPreview(URL.createObjectURL(file));
    setAvatarUploading(true);

    const formData = new FormData();
    formData.append("avatar", file);
    const { url, error } = await uploadAvatar(formData);

    setAvatarUploading(false);
    if (error || !url) {
      setAvatarPreview(null);
      setSaveError(error ?? "Upload failed"); setSaveState("error"); return;
    }
    setProfile((prev) => prev ? { ...prev, avatar_url: url } : prev);
    setAvatarPreview(null);
  }

  // ── Save profile edits ──
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaveState("saving");
    setSaveError(null);

    const updatedFields = {
      full_name:       editForm.full_name.trim(),
      username:        editForm.username.trim(),
      age:             editForm.age ? Number(editForm.age) : null,
      school_id:       editForm.school_id || null,
      major_id:        editForm.major_id  || null,
      education_level: editForm.education_level || null,
      semester_term:   editForm.semester_term.trim() || null,
    };

    // Snapshot for rollback, then apply immediately so the UI updates at once.
    const snapshotProfile = profile;
    setProfile((prev) => prev ? { ...prev, ...updatedFields } : prev);

    const { error } = await supabase
      .from("profiles")
      .update(updatedFields)
      .eq("id", profile.id);

    if (error) {
      setProfile(snapshotProfile); // rollback
      setSaveState("error");
      setSaveError(error.message);
      return;
    }

    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 2500);
  }

  if (loading || !profile) {
    return (
      <div className="min-h-full bg-canvas px-4 pt-6 pb-16 sm:px-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="h-36 rounded-2xl bg-surface border border-border animate-pulse" />
          <div className="h-52 rounded-2xl bg-surface border border-border animate-pulse" />
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-surface border border-border animate-pulse" />
            ))}
          </div>
          <div className="h-64 rounded-2xl bg-surface border border-border animate-pulse" />
        </div>
      </div>
    );
  }

  const level      = getLevel(profile.points);
  const joinedLabel = new Date(profile.joined_at).toLocaleDateString("en-SG", {
    month: "short",
    year: "numeric",
  });

  return (
    <div className="min-h-full bg-canvas px-4 pt-6 pb-16 sm:px-6">
      {/* Floating points earned animation */}
      <AnimatePresence>
        {pointsDelta !== null && (
          <motion.div
            key="pts-delta"
            initial={{ opacity: 1, y: 0, scale: 0.9 }}
            animate={{ opacity: 0, y: -60, scale: 1.15 }}
            transition={{ duration: 2.2, ease: "easeOut" }}
            className="fixed top-24 right-4 z-50 flex items-center gap-1.5 bg-gold text-ink font-bold text-base px-4 py-2 rounded-full shadow-lg pointer-events-none"
          >
            <Coins size={16} />
            +{pointsDelta} pts
          </motion.div>
        )}
      </AnimatePresence>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Hero card ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.4,
            ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
          }}
          className="relative overflow-hidden bg-surface rounded-2xl p-6 shadow-sm border border-border"
        >
          <div className="pointer-events-none absolute -top-8 -left-8 w-36 h-36 rounded-full bg-brand opacity-20 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-4 right-6 w-28 h-28 rounded-full bg-brand-light opacity-30 blur-xl" />

          <div className="relative flex flex-col sm:flex-row sm:items-start gap-4">
            {/* Hidden file input */}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />

            {/* Clickable avatar */}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="relative shrink-0 w-20 h-20 rounded-2xl bg-brand-light flex items-center justify-center text-3xl font-extrabold text-ink shadow-sm select-none group overflow-hidden"
              aria-label="Upload profile picture"
            >
              {(avatarPreview ?? profile.avatar_url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarPreview ?? profile.avatar_url!}
                  alt={profile.full_name}
                  className="w-full h-full rounded-2xl object-cover"
                />
              ) : (
                profile.full_name.charAt(0)
              )}
              {/* Camera overlay on hover */}
              {!avatarUploading && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={20} className="text-white" />
                </div>
              )}
              {/* Spinner while uploading */}
              {avatarUploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 size={20} className="text-white animate-spin" />
                </div>
              )}
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h1 className="text-xl font-extrabold text-ink leading-tight">
                    {profile.full_name}
                  </h1>
                  <p className="text-sm text-ink-muted">@{profile.username}</p>
                </div>
                <a
                  href="#edit-profile"
                  className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-border text-ink-muted hover:text-ink hover:bg-canvas transition-colors duration-150"
                >
                  <Settings size={12} />
                  Edit
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${level.badgeClass}`}>
                  {level.emoji} {level.name}
                </span>
                <span className="text-xs text-ink-faint">
                  Member since {joinedLabel}
                </span>
              </div>

              {/* School / major / education info */}
              {(profile.education_level || profile.semester_term) && (
                <p className="text-xs text-ink-faint mt-1.5">
                  {[profile.education_level, profile.semester_term]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Stats grid ── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-3 gap-3"
        >
          {(
            [
              { label: "Total Points", value: profile.points,         suffix: "",      icon: Coins,  iconClass: "text-gold",       bg: "bg-gold-light"  },
              { label: "Study Streak", value: profile.streak_days,    suffix: " days", icon: Flame,  iconClass: "text-alert",      bg: "bg-alert-light" },
              { label: "Check-ins",    value: profile.total_checkins, suffix: "",      icon: MapPin, iconClass: "text-brand-dark", bg: "bg-brand-faint" },
            ] as const
          ).map(({ label, value, suffix, icon: Icon, iconClass, bg }) => (
            <motion.div
              key={label}
              variants={cardVariants}
              className="bg-surface rounded-2xl p-4 shadow-sm border border-border text-center"
            >
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mx-auto mb-2`}>
                <Icon size={16} className={iconClass} />
              </div>
              <p className="text-2xl font-extrabold text-ink leading-none">
                <CountUp to={value} suffix={suffix} />
              </p>
              <p className="text-xs text-ink-muted mt-1 leading-tight">{label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Edit Profile ── */}
        <section
          id="edit-profile"
          className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Settings size={16} className="text-ink-muted" />
            <h2 className="font-semibold text-ink">Edit Profile</h2>
          </div>

          <form onSubmit={handleSaveProfile} className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Email (read-only — managed in Settings) */}
              <div className="sm:col-span-2">
                <label className={FIELD_LABEL}>Email</label>
                <div className={`${FIELD_INPUT} bg-canvas/50 text-ink-muted cursor-not-allowed select-none`}>
                  {profile.email}
                </div>
                <p className="mt-1 text-xs text-ink-faint">
                  To change your email, go to{" "}
                  <a href="/settings" className="underline hover:text-ink">Settings</a>.
                </p>
              </div>

              {/* Full Name */}
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

              {/* Username */}
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

              {/* Age */}
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

              {/* Education Level */}
              <div>
                <label className={FIELD_LABEL}>Education Level</label>
                <div className="relative">
                  <select
                    value={editForm.education_level}
                    onChange={(e) => setEdit("education_level", e.target.value)}
                    className={`${FIELD_INPUT} appearance-none cursor-pointer pr-8`}
                  >
                    <option value="">Select…</option>
                    <option value="Diploma">Diploma</option>
                    <option value="Undergraduate">Undergraduate</option>
                    <option value="Postgraduate">Postgraduate</option>
                  </select>
                </div>
              </div>

              {/* School */}
              <div>
                <label className={FIELD_LABEL}>School</label>
                <div className="relative">
                  <select
                    value={editForm.school_id}
                    onChange={(e) => {
                      setEdit("school_id", Number(e.target.value));
                      setEdit("major_id", 0);
                    }}
                    className={`${FIELD_INPUT} appearance-none cursor-pointer pr-8`}
                  >
                    <option value={0}>Select school…</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.abbr} — {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Major */}
              <div>
                <label className={FIELD_LABEL}>Major</label>
                <div className="relative">
                  <select
                    value={editForm.major_id}
                    onChange={(e) => setEdit("major_id", Number(e.target.value))}
                    disabled={editForm.school_id === 0 || majors.length === 0}
                    className={`${FIELD_INPUT} appearance-none cursor-pointer pr-8 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <option value={0}>
                      {editForm.school_id === 0 ? "Select school first…" : "Select major…"}
                    </option>
                    {majors.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Semester / Term */}
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

            {/* Save row */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={saveState === "saving"}
                className="px-5 py-2.5 rounded-full bg-ink text-surface text-sm font-medium hover:bg-ink/80 active:scale-95 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saveState === "saving" ? "Saving…" : "Save Profile"}
              </button>

              <AnimatePresence>
                {saveState === "saved" && (
                  <motion.div
                    key="saved"
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 text-success text-sm"
                  >
                    <CheckCircle2 size={15} />
                    <span>Saved!</span>
                  </motion.div>
                )}
                {saveState === "error" && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 text-alert text-sm"
                  >
                    <XCircle size={15} />
                    <span>{saveError ?? "Failed to save."}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </form>
        </section>



        {/* ── IT Club Badges ── */}
        <section>
          <h2 className="text-base font-bold text-ink mb-3">IT Club Badges</h2>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {achievements.map((achievement) => {
              const rCfg = RARITY_CONFIG[achievement.rarity];
              const Icon = achievement.icon;
              return (
                <motion.div
                  key={achievement.id}
                  variants={cardVariants}
                  className={`flex items-start gap-3 p-4 rounded-2xl border ${
                    achievement.unlocked
                      ? "bg-surface border-border"
                      : "bg-surface/60 border-border/50 opacity-55"
                  }`}
                >
                  <div
                    className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                      achievement.unlocked ? rCfg.bg : "bg-border"
                    }`}
                  >
                    {achievement.unlocked ? (
                      <Icon size={18} className={rCfg.iconClass} />
                    ) : (
                      <Lock size={15} className="text-ink-faint" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-semibold leading-tight ${achievement.unlocked ? "text-ink" : "text-ink-muted"}`}>
                        {achievement.name}
                      </p>
                      {achievement.unlocked && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${rCfg.bg} ${rCfg.iconClass}`}>
                          {rCfg.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">
                      {achievement.description}
                    </p>
                    {achievement.unlocked && achievement.unlockedAt && (
                      <p className="text-[10px] text-ink-faint mt-1">Earned {achievement.unlockedAt}</p>
                    )}
                    {!achievement.unlocked && achievement.progress && (
                      <p className="text-[10px] text-ink-faint mt-1">Progress: {achievement.progress}</p>
                    )}
                  </div>

                  {achievement.unlocked && (
                    <CheckCircle2 size={16} className="shrink-0 text-success mt-0.5" />
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </section>

        {/* ── Recent Activity ── */}
        <section>
          <h2 className="text-base font-bold text-ink mb-3">Recent Activity</h2>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.35,
              ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
              delay: 0.15,
            }}
            className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden"
          >
            <AnimatePresence>
              {activity.length === 0 ? (
                <p className="px-4 py-6 text-sm text-ink-muted text-center">No activity yet.</p>
              ) : activity.map((item, index) => {
                const cfg  = ACTIVITY_CONFIG[item.type];
                const Icon = cfg.icon;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-4 py-3.5 ${
                      index < activity.length - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    <div className={`shrink-0 w-8 h-8 rounded-xl ${cfg.bg} flex items-center justify-center`}>
                      <Icon size={14} className={cfg.iconClass} />
                    </div>
                    <p className="flex-1 text-sm text-ink leading-snug min-w-0">
                      {item.description}
                    </p>
                    <p className="shrink-0 text-xs text-ink-faint whitespace-nowrap">
                      {item.time}
                    </p>
                  </div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </section>

      </div>
    </div>
  );
}
