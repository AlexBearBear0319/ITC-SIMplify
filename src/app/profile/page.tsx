"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { getLevelNumber } from "@/lib/levels";
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
  Zap,
  Shield,
  Compass,
  Award,
  Target,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
  exp: number;
  streak_days: number;
  total_checkins: number;
  joined_at: string;
  age: number | null;
  school_id: number | null;
  major_id: number | null;
  education_level: string | null;
  semester_term: string | null;
  equipped_badge_id: number | null;
};

type AchievementRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

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

type ActivityType =
  | "checkin"
  | "redemption"
  | "collection"
  | "group"
  | "event"
  | "badge"
  | "session"
  | "mission"
  | "level_up";

type ActivityItem = {
  id: string;
  type: ActivityType;
  description: string;
  created_at: string;
};

// ─────────────────────────────────────────────
// Config maps
// ─────────────────────────────────────────────

const RARITY_CONFIG: Record<AchievementRarity, { bg: string; iconClass: string; label: string; shineClass: string }> = {
  common:    { bg: "bg-brand-faint",   iconClass: "text-brand-dark", label: "Common",    shineClass: "rarity-common"    },
  uncommon:  { bg: "bg-success-light", iconClass: "text-success",    label: "Uncommon",  shineClass: "rarity-uncommon"  },
  rare:      { bg: "bg-gold-light",    iconClass: "text-gold",       label: "Rare",      shineClass: "rarity-rare"      },
  epic:      { bg: "bg-alert-light",   iconClass: "text-alert",      label: "Epic",      shineClass: "rarity-epic"      },
  legendary: { bg: "bg-brand-light",   iconClass: "text-brand",      label: "Legendary", shineClass: "rarity-legendary" },
};

const ACTIVITY_CONFIG: Record<ActivityType, { icon: LucideIcon; bg: string; iconClass: string }> = {
  checkin:    { icon: MapPin,       bg: "bg-brand-faint",   iconClass: "text-brand-dark" },
  redemption: { icon: Gift,         bg: "bg-gold-light",    iconClass: "text-gold"       },
  collection: { icon: CheckCircle2, bg: "bg-success-light", iconClass: "text-success"    },
  group:      { icon: Users,        bg: "bg-success-light", iconClass: "text-success"    },
  event:      { icon: CalendarDays, bg: "bg-alert-light",   iconClass: "text-alert"      },
  badge:      { icon: Trophy,       bg: "bg-brand-light",   iconClass: "text-brand-dark" },
  session:    { icon: BookOpen,     bg: "bg-brand-faint",   iconClass: "text-brand-dark" },
  mission:    { icon: Target,       bg: "bg-gold-light",    iconClass: "text-gold"       },
  level_up:   { icon: Zap,          bg: "bg-success-light", iconClass: "text-success"    },
};

const ICON_MAP: Record<string, LucideIcon> = {
  // underscored variants
  book_open:     BookOpen,
  map_pin:       MapPin,
  check_circle:  CheckCircle2,
  users:         Users,
  calendar_days: CalendarDays,
  coins:         Coins,
  flame:         Flame,
  star:          Star,
  trophy:        Trophy,
  crown:         Crown,
  zap:           Zap,
  shield:        Shield,
  compass:       Compass,
  award:         Award,
  // hyphenated variants (used in seed SQL)
  "book-open":     BookOpen,
  "map-pin":       MapPin,
  "check-circle":  CheckCircle2,
  "calendar-days": CalendarDays,
};

const DEFAULT_PROFILE_ICON = "/profile_default.png";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatTimelineTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-SG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mapActivityType(rawType: string, description: string): ActivityType {
  const type = rawType.toLowerCase();
  const text = description.toLowerCase();
  if (type === "checkin") return "checkin";
  if (type === "redemption") return /collect|claim/.test(text) ? "collection" : "redemption";
  if (type === "group") return "group";
  if (type === "event") return "event";
  if (type === "badge" || type === "achievement") return "badge";
  if (type === "mission") return "mission";
  if (type === "level_up" || type === "levelup" || type === "level") return "level_up";
  if (type === "session") return "session";

  if (/mission/.test(text)) return "mission";
  if (/level/.test(text)) return "level_up";
  if (/collect|claim/.test(text)) return "collection";
  if (/redeem|reward/.test(text)) return "redemption";
  if (/badge|achievement/.test(text)) return "badge";
  if (/group/.test(text)) return "group";
  if (/check.?in|check.?out|leave|session/.test(text)) return "session";
  return "event";
}

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
  visible: { transition: { staggerChildren: 0.1 } },
};

const cardVariants = {
  hidden:  { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.48,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);

  const [profile,      setProfile]      = useState<UserProfile | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [activity,     setActivity]     = useState<ActivityItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const prevPointsRef  = useRef<number | null>(null);
  const [pointsDelta,  setPointsDelta]  = useState<number | null>(null);

  // Featured badges
  const [featuredIds, setFeaturedIds] = useState<number[]>([]);

  // ── Initial data load ──
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      await supabase.rpc("check_and_unlock_achievements", { p_user_id: user.id });

      const [
        { data: prof },
        { count },
        { count: groupCount },
        { data: allAchievements },
        { data: userAchievements },
        { data: activityData },
        { data: sessionsData },
        { data: userRedemptionsData },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url, points, exp, streak_days, age, school_id, major_id, education_level, semester_term, equipped_badge_id, featured_achievement_ids")
          .eq("id", user.id)
          .single(),
        supabase
          .from("active_sessions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("study_groups")
          .select("id", { count: "exact", head: true })
          .eq("host_id", user.id),
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
          .limit(10),
        supabase
          .from("active_sessions")
          .select("id, activity, module, duration_minutes, check_in_time, is_active, locations(name)")
          .eq("user_id", user.id)
          .not("check_in_time", "is", null)
          .order("check_in_time", { ascending: false })
          .limit(10),
        supabase
          .from("user_redemptions")
          .select("id, redeemed_at, claimed_at, status, redemption_items(name)")
          .eq("user_id", user.id)
          .order("redeemed_at", { ascending: false })
          .limit(20),
      ]);

      if (prof) {
        const pts    = prof.points      ?? 0;
        const expVal = prof.exp         ?? 0;
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
          education_level:   prof.education_level   ?? null,
          semester_term:     prof.semester_term     ?? null,
          equipped_badge_id: prof.equipped_badge_id ?? null,
        };
        setProfile(loaded);
        prevPointsRef.current = pts;
        setFeaturedIds((prof.featured_achievement_ids as number[]) ?? []);

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
            else if (a.unlock_type === "exp")
              progress = `${expVal.toLocaleString()} / ${a.unlock_threshold.toLocaleString()} exp`;
            else if (a.unlock_type === "checkins")
              progress = `${count ?? 0} / ${a.unlock_threshold} check-ins`;
            else if (a.unlock_type === "groups")
              progress = `${groupCount ?? 0} / ${a.unlock_threshold} group${a.unlock_threshold !== 1 ? "s" : ""} created`;
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

      const activityItems: ActivityItem[] = (activityData ?? [])
        .filter((a) => (a.type ?? "").toLowerCase() !== "redemption")
        .map((a) => ({
          id:          `log-${a.id}`,
          type:        mapActivityType(a.type, a.description),
          description: a.description,
          created_at:  a.created_at,
        }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sessionItems: ActivityItem[] = (sessionsData ?? []).map((s: any) => {
        const startedAt = s.check_in_time ? new Date(s.check_in_time) : null;
        const leaveAt = startedAt
          ? new Date(startedAt.getTime() + (s.duration_minutes ?? 0) * 60_000)
          : null;
        const locationName = s.locations?.name ?? "Unknown location";
        const rawActivity = String(s.activity ?? "").toLowerCase();
        const sessionType =
          rawActivity === "study_group"
            ? "Group study session"
            : rawActivity === "solo_study"
            ? "Solo study session"
            : rawActivity === "study"
            ? "Study session"
            : rawActivity === "eating"
            ? "Meal session"
            : "Session";
        const moduleLabel = s.module ? ` · ${s.module}` : "";
        const leaveLabel = leaveAt
          ? `Leave at ${leaveAt.toLocaleString("en-SG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
          : "Leave time unavailable";

        return {
          id:         `session-${s.id}`,
          type:       "session",
          description: `${sessionType} at ${locationName}${moduleLabel} · ${s.duration_minutes ?? 0} min · ${leaveLabel}`,
          created_at: s.check_in_time ?? new Date().toISOString(),
        };
      });

      const redemptionItems: ActivityItem[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const redemption of (userRedemptionsData ?? []) as any[]) {
        // Supabase relation can return object or one-element array depending on typing.
        const itemRef = redemption.redemption_items;
        const itemName = Array.isArray(itemRef) ? itemRef[0]?.name : itemRef?.name;
        const rewardName = itemName ?? "reward";

        if (redemption.redeemed_at) {
          redemptionItems.push({
            id: `redeem-${redemption.id}`,
            type: "redemption",
            description: `Redeemed "${rewardName}"`,
            created_at: redemption.redeemed_at,
          });
        }

        if (redemption.status === "claimed" && redemption.claimed_at) {
          redemptionItems.push({
            id: `collect-${redemption.id}`,
            type: "collection",
            description: `Collected "${rewardName}"`,
            created_at: redemption.claimed_at,
          });
        }
      }

      setActivity(
        [...activityItems, ...sessionItems, ...redemptionItems]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 25)
      );

      setLoading(false);
    });
  }, []);

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

  // ── Featured badges ──
  function handleToggleFeatured(id: number) {
    setFeaturedIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 3 ? [...prev, id] : prev;
      supabase.from("profiles")
        .update({ featured_achievement_ids: next })
        .eq("id", profile!.id)
        .then(() => {});
      return next;
    });
  }

  async function handleEquipBadge(id: number) {
    if (!profile) return;
    const previous = profile.equipped_badge_id;
    const next = previous === id ? null : id;

    setProfile((prev) => (prev ? { ...prev, equipped_badge_id: next } : prev));

    const { error } = await supabase
      .from("profiles")
      .update({ equipped_badge_id: next })
      .eq("id", profile.id);

    if (error) {
      setProfile((prev) => (prev ? { ...prev, equipped_badge_id: previous } : prev));
    }
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

  const levelNumber = getLevelNumber(profile.exp ?? 0);
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
            duration: 0.58,
            ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
          }}
          className={`relative overflow-hidden bg-surface rounded-2xl p-6 shadow-sm border ${
            level.level === 100 ? "border-gold/45 legend-glow" : "border-border"
          }`}
        >
          {level.level === 100 ? (
            <>
              <div className="pointer-events-none absolute -top-10 -left-10 w-52 h-52 rounded-full bg-gold opacity-20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-6 right-4 w-44 h-44 rounded-full bg-gold opacity-15 blur-2xl" />
              <div className="pointer-events-none absolute top-0 right-1/3 w-24 h-24 rounded-full bg-gold-light opacity-40 blur-2xl" />
              <div className="legend-sweep" />
            </>
          ) : (
            <>
              <div className="pointer-events-none absolute -top-8 -left-8 w-36 h-36 rounded-full bg-brand opacity-20 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-4 right-6 w-28 h-28 rounded-full bg-brand-light opacity-30 blur-xl" />
            </>
          )}

          <div className="relative flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="relative shrink-0 w-20 h-20 rounded-full bg-brand-light flex items-center justify-center text-3xl font-extrabold text-ink shadow-sm select-none overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={profile.avatar_url || DEFAULT_PROFILE_ICON}
                alt={profile.full_name}
                className="w-full h-full rounded-full object-cover"
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                {/* Left column: name, username, badges, education — all flow together */}
                <div className="min-w-0">
                  <h1 className="text-xl font-extrabold text-ink leading-tight">
                    {profile.full_name}
                  </h1>
                  <p className="text-sm text-ink-muted">@{profile.username}</p>

                  {/* Level + equipped badge + member since — directly below username */}
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${level.badgeClass}`}>
                      {level.emoji} {level.name}
                    </span>
                    {profile.equipped_badge_id && (() => {
                      const b = achievements.find((a) => a.id === profile.equipped_badge_id);
                      if (!b) return null;
                      const rCfg = RARITY_CONFIG[b.rarity];
                      const Icon = b.icon;
                      return (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${rCfg.bg} ${rCfg.iconClass}`}>
                          <Icon size={11} />
                          {b.name}
                        </span>
                      );
                    })()}
                    <span className="text-xs text-ink-faint">
                      Member since {joinedLabel}
                    </span>
                  </div>

                  {/* Featured badges */}
                  {featuredIds.length > 0 && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {featuredIds.map((fid) => {
                        const badge = achievements.find((a) => a.id === fid);
                        if (!badge) return null;
                        const rCfg = RARITY_CONFIG[badge.rarity];
                        const Icon = badge.icon;
                        return (
                          <div
                            key={fid}
                            title={badge.name}
                            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium ${rCfg.bg} ${rCfg.iconClass}`}
                          >
                            <Icon size={11} />
                            {badge.name}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* School / major / education info */}
                  {(profile.education_level || profile.semester_term) && (
                    <p className="text-xs text-ink-faint mt-1">
                      {[profile.education_level, profile.semester_term]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>

                {/* Right column: action buttons */}
                <div className="shrink-0 flex flex-col items-stretch gap-2">
                  <Link
                    href="/profile/edit"
                    className="flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2 rounded-full border border-border text-ink-muted hover:text-ink hover:bg-canvas transition-colors duration-150"
                  >
                    <Settings size={14} />
                    Edit Profile
                  </Link>
                  <Link
                    href="/profile/rewards"
                    className="flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2 rounded-full bg-gold-light text-gold border border-gold/30 hover:bg-gold hover:text-ink transition-colors duration-150"
                  >
                    <Gift size={14} />
                    My Rewards
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Stats grid ── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          {(
            [
              { label: "Total Points", value: profile.points,         suffix: "",      icon: Coins,  iconClass: "text-gold",       bg: "bg-gold-light"  },
              { label: "Total EXP",    value: profile.exp,            suffix: "",      icon: Zap,    iconClass: "text-success",    bg: "bg-success-light" },
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
                  className={`flex gap-3 p-4 rounded-2xl border ${
                    achievement.unlocked
                      ? `items-start bg-surface border-transparent ${rCfg.shineClass}`
                      : "items-center bg-surface/60 border-border/50 opacity-55"
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
                    <div className="flex flex-col items-center gap-1">
                      <CheckCircle2 size={16} className="shrink-0 text-success" />
                      <button
                        type="button"
                        onClick={() => handleEquipBadge(achievement.id)}
                        title={
                          profile.equipped_badge_id === achievement.id
                            ? "Badge equipped"
                            : "Equip badge"
                        }
                        className={`shrink-0 transition-colors ${
                          profile.equipped_badge_id === achievement.id
                            ? "text-brand-dark"
                            : "text-ink-faint hover:text-brand-dark"
                        }`}
                      >
                        <Crown size={15} fill={profile.equipped_badge_id === achievement.id ? "currentColor" : "none"} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleFeatured(achievement.id)}
                        title={
                          featuredIds.includes(achievement.id)
                            ? "Remove from profile"
                            : featuredIds.length >= 3
                            ? "Remove a badge first"
                            : "Show on profile"
                        }
                        disabled={!featuredIds.includes(achievement.id) && featuredIds.length >= 3}
                        className={`shrink-0 transition-colors ${
                          featuredIds.includes(achievement.id)
                            ? "text-gold"
                            : featuredIds.length >= 3
                            ? "text-ink-faint cursor-not-allowed"
                            : "text-ink-faint hover:text-gold"
                        }`}
                      >
                        <Star size={15} fill={featuredIds.includes(achievement.id) ? "currentColor" : "none"} />
                      </button>
                    </div>
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
                      {formatTimelineTime(item.created_at)}
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
