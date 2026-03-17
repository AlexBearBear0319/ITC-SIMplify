"use client";

/**
 * User Profile — /profile
 *
 * Supabase wiring:
 *   Replace MOCK_PROFILE with:
 *     const { data: profile } = await supabase
 *       .from("profiles")
 *       .select("id, full_name, username, avatar_url, points_balance, streak_days, total_checkins, joined_at")
 *       .eq("id", session.user.id)
 *       .single();
 *
 *   Replace MOCK_ACHIEVEMENTS with:
 *     const { data } = await supabase
 *       .from("user_achievements")
 *       .select("*, achievements(id, name, description, icon_key, rarity)")
 *       .eq("user_id", session.user.id);
 *
 *   Replace MOCK_ACTIVITY with:
 *     const { data } = await supabase
 *       .from("activity_log")
 *       .select("*")
 *       .eq("user_id", session.user.id)
 *       .order("created_at", { ascending: false })
 *       .limit(6);
 */

import { useEffect } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import Link from "next/link";
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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─────────────────────────────────────────────
// Types  (shapes match Supabase schema)
// ─────────────────────────────────────────────

type UserProfile = {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
  points_balance: number;
  streak_days: number;
  total_checkins: number;
  joined_at: string;
};

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
// Level system  (mirrors rewards/page.tsx tiers)
// ─────────────────────────────────────────────

const LEVELS = [
  { name: "Seedling", emoji: "🌱", minPts: 0,    badgeClass: "bg-success-light text-success"  },
  { name: "Explorer", emoji: "🔍", minPts: 500,   badgeClass: "bg-brand-faint text-brand-dark" },
  { name: "Scholar",  emoji: "📚", minPts: 1500,  badgeClass: "bg-brand-light text-ink"        },
  { name: "Champion", emoji: "🏆", minPts: 3000,  badgeClass: "bg-gold-light text-ink"         },
  { name: "Legend",   emoji: "⭐", minPts: 5000,  badgeClass: "bg-gold text-ink"               },
];

function getCurrentLevel(pts: number) {
  return [...LEVELS].reverse().find((l) => pts >= l.minPts) ?? LEVELS[0];
}

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

// ─────────────────────────────────────────────
// Mock data  ← swap with Supabase fetches
// ─────────────────────────────────────────────

// TODO: Replace with supabase.from("profiles").select(...).eq("id", userId).single()
const MOCK_PROFILE: UserProfile = {
  id: "uuid-alex",
  full_name: "Alex Vun",
  username: "alex_sim",
  avatar_url: null,
  points_balance: 1250,
  streak_days: 7,
  total_checkins: 24,
  joined_at: "2025-03-01T00:00:00Z",
};

// TODO: Replace with supabase.from("user_achievements").select("*, achievements(*)").eq("user_id", userId)
const MOCK_ACHIEVEMENTS: Achievement[] = [
  {
    id: 1, icon: BookOpen, name: "First Step",
    description: "Created your SIMplify account.",
    unlocked: true, unlockedAt: "Mar 2025", rarity: "common",
  },
  {
    id: 2, icon: MapPin, name: "Explorer",
    description: "Checked into your first study spot.",
    unlocked: true, unlockedAt: "Mar 2025", rarity: "common",
  },
  {
    id: 3, icon: Users, name: "Team Player",
    description: "Joined your first study group.",
    unlocked: true, unlockedAt: "Apr 2025", rarity: "common",
  },
  {
    id: 4, icon: CalendarDays, name: "Event Goer",
    description: "Attended your first IT Club event.",
    unlocked: true, unlockedAt: "Apr 2025", rarity: "common",
  },
  {
    id: 5, icon: Coins, name: "Point Starter",
    description: "Earned your first 500 points.",
    unlocked: true, unlockedAt: "May 2025", rarity: "common",
  },
  {
    id: 6, icon: Flame, name: "On a Roll",
    description: "Maintained a 7-day study streak.",
    unlocked: true, unlockedAt: "Mar 2026", rarity: "rare",
  },
  {
    id: 7, icon: Star, name: "Dedicated",
    description: "Reach a 30-day study streak.",
    unlocked: false, rarity: "rare", progress: "7 / 30 days",
  },
  {
    id: 8, icon: Trophy, name: "IT Champion",
    description: "Earn 5,000 total points.",
    unlocked: false, rarity: "epic", progress: "1,250 / 5,000 pts",
  },
  {
    id: 9, icon: Crown, name: "Legend",
    description: "Reach the maximum level.",
    unlocked: false, rarity: "epic",
  },
];

// TODO: Replace with supabase.from("activity_log").select("*").eq("user_id", userId).order("created_at", {ascending: false}).limit(6)
const MOCK_ACTIVITY: ActivityItem[] = [
  { id: 1, type: "checkin",    description: "Checked into Main IT Lab",               time: "2 hours ago" },
  { id: 2, type: "redemption", description: "Redeemed Canteen Coffee (−300 pts)",     time: "Yesterday"   },
  { id: 3, type: "group",      description: "Joined Web Dev – React & Next.js group", time: "2 days ago"  },
  { id: 4, type: "event",      description: "Attended Python Workshop",               time: "5 days ago"  },
  { id: 5, type: "badge",      description: "Earned \"On a Roll\" badge 🎉",          time: "7 days ago"  },
  { id: 6, type: "checkin",    description: "Checked into Library Level 3",           time: "8 days ago"  },
];

// ─────────────────────────────────────────────
// CountUp  (animates 0 → target on mount)
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
  const count = useMotionValue(0);
  const display = useTransform(count, (v) =>
    `${Math.round(v).toLocaleString()}${suffix}`
  );

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

export default function ProfilePage() {
  // TODO: Replace with Supabase fetch (see header comment)
  const profile = MOCK_PROFILE;
  const level = getCurrentLevel(profile.points_balance);
  const joinedLabel = new Date(profile.joined_at).toLocaleDateString("en-SG", {
    month: "short",
    year: "numeric",
  });

  return (
    <div className="min-h-full bg-canvas px-4 pt-6 pb-16 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">

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
          {/* Ambient blobs */}
          <div className="pointer-events-none absolute -top-8 -left-8 w-36 h-36 rounded-full bg-brand opacity-20 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-4 right-6 w-28 h-28 rounded-full bg-brand-light opacity-30 blur-xl" />

          <div className="relative flex flex-col sm:flex-row sm:items-start gap-4">
            {/* Avatar */}
            <div className="shrink-0 w-20 h-20 rounded-2xl bg-brand-light flex items-center justify-center text-3xl font-extrabold text-ink shadow-sm select-none">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="w-full h-full rounded-2xl object-cover"
                />
              ) : (
                profile.full_name.charAt(0)
              )}
            </div>

            {/* Name, username, badges */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h1 className="text-xl font-extrabold text-ink leading-tight">
                    {profile.full_name}
                  </h1>
                  <p className="text-sm text-ink-muted">@{profile.username}</p>
                </div>
                <Link
                  href="/settings"
                  className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-border text-ink-muted hover:text-ink hover:bg-canvas transition-colors duration-150"
                >
                  <Settings size={12} />
                  Edit
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${level.badgeClass}`}>
                  {level.emoji} {level.name}
                </span>
                <span className="text-xs text-ink-faint">
                  Member since {joinedLabel}
                </span>
              </div>
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
              { label: "Total Points", value: profile.points_balance, suffix: "",      icon: Coins,  iconClass: "text-gold",       bg: "bg-gold-light"   },
              { label: "Study Streak", value: profile.streak_days,    suffix: " days", icon: Flame,  iconClass: "text-alert",      bg: "bg-alert-light"  },
              { label: "Check-ins",    value: profile.total_checkins, suffix: "",      icon: MapPin, iconClass: "text-brand-dark", bg: "bg-brand-faint"  },
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
            {MOCK_ACHIEVEMENTS.map((achievement) => {
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
              {MOCK_ACTIVITY.map((item, index) => {
                const cfg = ACTIVITY_CONFIG[item.type];
                const Icon = cfg.icon;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-4 py-3.5 ${
                      index < MOCK_ACTIVITY.length - 1 ? "border-b border-border" : ""
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
