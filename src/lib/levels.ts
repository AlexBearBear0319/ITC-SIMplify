// Level tier definitions — single source of truth used by profile, leaderboard, and rewards.
// Thresholds: 0 → Seedling · 500 → Explorer · 1500 → Scholar · 3000 → Champion · 5000 → Legend

export type LevelTier = {
  name: string;
  emoji: string;
  minPts: number;
  nextPts: number;       // Infinity for the top tier
  badgeClass: string;    // Tailwind classes for the level badge pill
};

export const LEVELS: LevelTier[] = [
  { name: "Seedling", emoji: "🌱", minPts: 0,    nextPts: 500,      badgeClass: "bg-success-light text-success"  },
  { name: "Explorer", emoji: "🔍", minPts: 500,   nextPts: 1500,     badgeClass: "bg-brand-faint text-brand-dark" },
  { name: "Scholar",  emoji: "📚", minPts: 1500,  nextPts: 3000,     badgeClass: "bg-brand-light text-ink"        },
  { name: "Champion", emoji: "🏆", minPts: 3000,  nextPts: 5000,     badgeClass: "bg-gold-light text-ink"         },
  { name: "Legend",   emoji: "⭐", minPts: 5000,  nextPts: Infinity, badgeClass: "bg-gold text-ink"               },
];

/** Returns the current tier plus progress percentage through it (0–100). */
export function getLevel(pts: number): LevelTier & { progress: number } {
  const tier = [...LEVELS].reverse().find((l) => pts >= l.minPts) ?? LEVELS[0];
  const progress =
    tier.nextPts === Infinity
      ? 100
      : Math.min(100, Math.round(((pts - tier.minPts) / (tier.nextPts - tier.minPts)) * 100));
  return { ...tier, progress };
}

/** Just the emoji for a point total — useful when you only need the icon. */
export function getLevelEmoji(pts: number): string {
  return getLevel(pts).emoji;
}

/** Level number 1–5, matching the `level` column in the profiles table. */
export function getLevelNumber(pts: number): number {
  const idx = [...LEVELS].reverse().findIndex((l) => pts >= l.minPts);
  return LEVELS.length - (idx === -1 ? LEVELS.length - 1 : idx);
}
