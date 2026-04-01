"use client";

/**
 * Campus Leaderboard — /leaderboard
 *
 * Fetches profiles ordered by points desc, limited to top 50.
 * Marks the current authenticated user via auth.getUser().
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Coins, Crown } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getLevelNumber } from "@/lib/levels";

// ── Types ───────────────────────────────────────

type LeaderboardEntry = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  points: number;
  exp: number;
  is_current_user?: boolean;
};

const getDisplayName = (entry: LeaderboardEntry) =>
  entry.full_name?.trim() || entry.username?.trim() || "Student";

// ── Podium config (visual treatment per rank) ──

type PodiumCfg = {
  mt: string;
  cardClass: string;
  avatarClass: string;
  pointsClass: string;
  avatarSize: string;
  medal: string;
  showCrown: boolean;
};

const PODIUM_CFG: Record<1 | 2 | 3, PodiumCfg> = {
  1: {
    mt: "",
    cardClass:   "bg-gold-light border border-gold/40 ring-2 ring-gold/25 shadow-md",
    avatarClass: "bg-gold/20 text-ink ring-2 ring-gold/40",
    pointsClass: "text-gold",
    avatarSize:  "w-16 h-16 text-xl",
    medal:       "🥇",
    showCrown:   true,
  },
  2: {
    mt: "mt-5",
    cardClass:   "bg-brand-faint border border-brand/30",
    avatarClass: "bg-brand-light text-ink",
    pointsClass: "text-brand-dark",
    avatarSize:  "w-12 h-12 text-base",
    medal:       "🥈",
    showCrown:   false,
  },
  3: {
    mt: "mt-9",
    cardClass:   "bg-canvas border border-border",
    avatarClass: "bg-border text-ink-muted",
    pointsClass: "text-ink-muted",
    avatarSize:  "w-12 h-12 text-base",
    medal:       "🥉",
    showCrown:   false,
  },
};

// ── Animation variants ─────────────────────────

const podiumVariants = {
  hidden:  { opacity: 0, y: 28 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      delay,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const rowVariants = {
  hidden:  { opacity: 0, x: -14 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

// ── Avatar helper ──────────────────────────────

function Avatar({
  entry,
  sizeClass,
  extraClass = "",
}: {
  entry: LeaderboardEntry;
  sizeClass: string;
  extraClass?: string;
}) {
  const displayName = getDisplayName(entry);

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold select-none ${sizeClass} ${extraClass}`}
    >
      {entry.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.avatar_url}
          alt={displayName}
          className="w-full h-full rounded-full object-cover"
        />
      ) : (
        (entry.full_name ?? entry.username ?? "?").charAt(0).toUpperCase()
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────

export default function LeaderboardPage() {
  const supabase = createClient();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async () => {
    const [{ data: profiles }, { data: { user } }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url, points, exp")
        .order("points", { ascending: false })
        .limit(50),
      supabase.auth.getUser(),
    ]);
    if (profiles) {
      setEntries(profiles.map((p) => ({ ...p, is_current_user: p.id === user?.id })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchLeaderboard(); }, []);

  // Re-fetch whenever any profile's points change
  useEffect(() => {
    const channel = supabase
      .channel("leaderboard-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, fetchLeaderboard)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const top3   = entries.slice(0, 3);
  const rest   = entries.slice(3);
  const meIdx  = entries.findIndex((u) => u.is_current_user);
  const myRank = meIdx >= 0 ? meIdx + 1 : null;
  const me     = meIdx >= 0 ? entries[meIdx] : null;

  // Podium is displayed as: 2nd | 1st | 3rd (classic podium layout)
  const podiumOrder: [LeaderboardEntry, 1 | 2 | 3, number][] = [
    [top3[1], 2, 0.1],
    [top3[0], 1, 0.0],
    [top3[2], 3, 0.2],
  ];

  if (loading) {
    return (
      <div className="min-h-full bg-canvas px-4 pt-6 pb-16 sm:px-6">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-extrabold text-ink">Campus Leaderboard</h1>
            <p className="text-sm text-ink-muted mt-1">Top contributors keeping SIMplify updated.</p>
          </div>
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 h-48 rounded-2xl bg-canvas animate-pulse" />
            ))}
          </div>
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-canvas animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-canvas px-4 pt-6 pb-16 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── Page header ── */}
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Campus Leaderboard</h1>
          <p className="text-sm text-ink-muted mt-1">
            Top contributors keeping SIMplify updated.
          </p>
        </div>

        {/* ── Your rank banner (only when outside top 3) ── */}
        {me && myRank && myRank > 3 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.35,
              ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-brand-faint border border-brand/30"
          >
            <Avatar
              entry={me}
              sizeClass="w-10 h-10 text-sm"
              extraClass="bg-brand-light text-ink shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink">
                You&apos;re ranked <span className="text-brand-dark">#{myRank}</span>
              </p>
              <p className="text-xs text-ink-muted">
                {me.points.toLocaleString()} pts — keep checking in to climb!
              </p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-brand-faint text-brand-dark border border-brand/20 shrink-0">
              Level {getLevelNumber(me.exp ?? 0)}
            </span>
          </motion.div>
        )}

        {/* ── Top 3 Podium ── */}
        <section>
          <div className="flex items-start gap-3">
            {podiumOrder.map(([entry, rank, delay]) => {
              if (!entry) return null;
              const cfg = PODIUM_CFG[rank];
              return (
                <motion.div
                  key={entry.id}
                  custom={delay}
                  variants={podiumVariants}
                  initial="hidden"
                  animate="visible"
                  className={[
                    "flex-1 flex flex-col items-center gap-2 rounded-2xl p-4 text-center",
                    cfg.cardClass,
                    cfg.mt,
                    entry.is_current_user ? "ring-2 ring-brand!" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {cfg.showCrown && (
                    <Crown size={18} className="text-gold fill-gold/30" />
                  )}

                  <span className="text-2xl leading-none">{cfg.medal}</span>

                  <Avatar
                    entry={entry}
                    sizeClass={cfg.avatarSize}
                    extraClass={cfg.avatarClass}
                  />

                    <div className="w-full">
                      <p className="text-sm font-bold text-ink leading-tight truncate">
                        {getDisplayName(entry)}
                      </p>
                      <p className="text-[10px] text-ink-muted mt-0.5">Level {getLevelNumber(entry.exp ?? 0)}</p>
                      {entry.is_current_user && (
                        <span className="text-[10px] font-medium text-ink-muted">(you)</span>
                      )}
                    <p
                      className={`text-xs font-semibold mt-1 flex items-center justify-center gap-1 ${cfg.pointsClass}`}
                    >
                      <Coins size={11} />
                      {entry.points.toLocaleString()}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* ── Full rankings (4 →) ── */}
        <section>
          <p className="text-xs font-semibold text-ink-faint uppercase tracking-widest mb-3">
            Rankings
          </p>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden"
          >
            {rest.map((entry, i) => {
              const rank         = i + 4;
              const isCurrent    = !!entry.is_current_user;

              return (
                <motion.div
                  key={entry.id}
                  variants={rowVariants}
                  className={[
                    "flex items-center gap-3 px-4 py-3.5",
                    i < rest.length - 1 ? "border-b border-border" : "",
                    isCurrent ? "bg-brand-faint" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {/* Rank number */}
                  <div className="w-7 shrink-0 text-right">
                    <span
                      className={`text-sm font-bold ${
                        isCurrent ? "text-brand-dark" : "text-ink-faint"
                      }`}
                    >
                      {rank}
                    </span>
                  </div>

                  {/* Avatar */}
                  <Avatar
                    entry={entry}
                    sizeClass="w-9 h-9 text-sm shrink-0"
                    extraClass={
                      isCurrent
                        ? "bg-brand-light text-ink"
                        : "bg-canvas text-ink-muted"
                    }
                  />

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold text-ink leading-tight truncate">
                        {getDisplayName(entry)}
                      </p>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-faint text-brand-dark border border-brand/20 leading-none">
                        Level {getLevelNumber(entry.exp ?? 0)}
                      </span>
                      {isCurrent && (
                        <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-brand text-ink leading-none">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-faint">@{entry.username ?? "anonymous"}</p>
                  </div>

                  {/* Points */}
                  <div className="shrink-0 flex items-center gap-1 font-bold text-gold text-sm">
                    <Coins size={13} />
                    <span>{entry.points.toLocaleString()}</span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </section>

      </div>
    </div>
  );
}
