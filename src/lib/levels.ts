// Level system — 100 levels across 10 named tiers (10 levels each).
// Formula: totalExpForLevel(n) = round(55 * (n-1)^1.5)
//
// Tier transitions (approximate EXP):
//   Seedling  Lv  1–10  →  0 EXP
//   Explorer  Lv 11–20  →  1,739 EXP
//   Scholar   Lv 21–30  →  4,919 EXP
//   Achiever  Lv 31–40  →  9,037 EXP
//   Enthusiast Lv 41–50 → 13,914 EXP
//   Specialist Lv 51–60 → 19,445 EXP
//   Expert    Lv 61–70  → 25,562 EXP
//   Champion  Lv 71–80  → 32,211 EXP
//   Master    Lv 81–90  → 39,355 EXP
//   Legend    Lv 91–100 → 46,960 EXP  (max level 100 = 54,179 EXP)
//
// Pacing: casual user (~50 EXP/day) reaches level 100 in ~3 years.
//         active user (~200 EXP/day) reaches level 100 in ~9 months.

// ─── Internal tier definitions ────────────────────────────────────────────────

const TIERS = [
  { name: "Seedling",   emoji: "🌱", badgeClass: "bg-success-light text-success"  },
  { name: "Explorer",   emoji: "🔍", badgeClass: "bg-brand-faint text-brand-dark" },
  { name: "Scholar",    emoji: "📖", badgeClass: "bg-brand-light text-ink"        },
  { name: "Achiever",   emoji: "✨", badgeClass: "bg-brand/20 text-brand-dark"    },
  { name: "Enthusiast", emoji: "🔥", badgeClass: "bg-alert-light text-alert"      },
  { name: "Specialist", emoji: "⚡", badgeClass: "bg-alert/20 text-alert"         },
  { name: "Expert",     emoji: "💎", badgeClass: "bg-gold-light text-gold"        },
  { name: "Champion",   emoji: "🏆", badgeClass: "bg-gold-light text-ink"         },
  { name: "Master",     emoji: "👑", badgeClass: "bg-gold/40 text-ink"            },
  { name: "Legend",     emoji: "⭐", badgeClass: "bg-gold text-ink"               },
] as const;

/** Cumulative EXP required to reach level n (level 1 starts at 0). */
function totalExpForLevel(n: number): number {
  if (n <= 1) return 0;
  return Math.round(55 * Math.pow(n - 1, 1.5));
}

/** Convert a raw EXP total to a level number (1–100). */
function expToLevel(exp: number): number {
  for (let n = 100; n >= 2; n--) {
    if (exp >= totalExpForLevel(n)) return n;
  }
  return 1;
}

// ─── Exported types & constants ───────────────────────────────────────────────

/**
 * Shape of a level tier — kept identical to the old interface so all
 * existing call sites (profile, rewards, leaderboard) continue to work.
 */
export type LevelTier = {
  name: string;
  emoji: string;
  minPts: number;   // EXP at the start of this exact level
  nextPts: number;  // EXP at the start of the next level (Infinity at level 100)
  badgeClass: string;
};

/**
 * 10-entry array (one per tier) — exported for the rewards page which
 * references LEVELS to look up the next tier name in the progress bar.
 */
export const LEVELS: LevelTier[] = TIERS.map((t, i) => ({
  ...t,
  minPts:  totalExpForLevel(i * 10 + 1),
  nextPts: i < 9 ? totalExpForLevel(i * 10 + 11) : Infinity,
}));

// ─── Exported functions ───────────────────────────────────────────────────────

/**
 * Returns the current tier, level number, and progress for a given EXP total.
 * The `level` field (1–100) is new — all existing fields are unchanged.
 */
export function getLevel(exp: number): LevelTier & { progress: number; level: number } {
  const currentLevel = expToLevel(exp);
  const tier         = TIERS[Math.floor((currentLevel - 1) / 10)];
  const levelStart   = totalExpForLevel(currentLevel);
  const levelEnd     = currentLevel < 100 ? totalExpForLevel(currentLevel + 1) : Infinity;
  const progress     = levelEnd === Infinity
    ? 100
    : Math.min(100, Math.round(((exp - levelStart) / (levelEnd - levelStart)) * 100));

  return {
    name:       tier.name,
    emoji:      tier.emoji,
    minPts:     levelStart,
    nextPts:    levelEnd,
    badgeClass: tier.badgeClass,
    progress,
    level:      currentLevel,
  };
}

/** Just the tier emoji for a given EXP — backward compatible. */
export function getLevelEmoji(exp: number): string {
  return getLevel(exp).emoji;
}

/** Level number 1–100 for a given EXP — replaces the old 1–5 scale. */
export function getLevelNumber(exp: number): number {
  return expToLevel(exp);
}
