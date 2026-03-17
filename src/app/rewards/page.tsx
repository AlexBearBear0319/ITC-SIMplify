"use client";

/**
 * Rewards & Redemption Store — /rewards
 *
 * No additional packages required. Uses @radix-ui/react-dialog and
 * framer-motion, both already installed from earlier phases.
 */

import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  Coins,
  Coffee,
  Package,
  Monitor,
  BookOpen,
  Gift,
  Award,
  Star,
  Zap,
  CheckCircle2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// ─────────────────────────────────────────────
// Types  (shapes match Supabase schema)
// ─────────────────────────────────────────────

type ItemCategory = "physical" | "virtual" | "booking";

type RedemptionItem = {
  id: number;
  name: string;
  description: string;
  points_cost: number;
  stock_remaining: number;
  category: ItemCategory;
  is_active: boolean;
  created_at: string;
};

type UserRewards = {
  username: string;
  avatar_url: string | null;
  points_balance: number;
  total_points_earned: number;
};

// ─────────────────────────────────────────────
// Level tier system
// ─────────────────────────────────────────────

type LevelTier = {
  name: string;
  emoji: string;
  minPts: number;
  nextPts: number;
  badgeClass: string;
};

const LEVELS: LevelTier[] = [
  { name: "Seedling", emoji: "🌱", minPts: 0,    nextPts: 500,      badgeClass: "bg-success-light text-success" },
  { name: "Explorer", emoji: "🔍", minPts: 500,   nextPts: 1500,     badgeClass: "bg-brand-faint text-brand-dark" },
  { name: "Scholar",  emoji: "📚", minPts: 1500,  nextPts: 3000,     badgeClass: "bg-brand-light text-ink" },
  { name: "Champion", emoji: "🏆", minPts: 3000,  nextPts: 5000,     badgeClass: "bg-gold-light text-ink" },
  { name: "Legend",   emoji: "⭐", minPts: 5000,  nextPts: Infinity, badgeClass: "bg-gold text-ink" },
];

function getLevel(pts: number): LevelTier & { progress: number } {
  const tier = [...LEVELS].reverse().find((l) => pts >= l.minPts) ?? LEVELS[0];
  const progress =
    tier.nextPts === Infinity
      ? 100
      : Math.min(100, Math.round(((pts - tier.minPts) / (tier.nextPts - tier.minPts)) * 100));
  return { ...tier, progress };
}

// ─────────────────────────────────────────────
// Category config
// ─────────────────────────────────────────────

const CATEGORY_CONFIG: Record<ItemCategory, { label: string; pill: string }> = {
  physical: { label: "Physical", pill: "bg-brand-faint text-brand-dark" },
  virtual:  { label: "Virtual",  pill: "bg-gold-light text-ink"         },
  booking:  { label: "Booking",  pill: "bg-success-light text-success"  },
};

// Icon per item id — falls back to Gift for unknown IDs
const ITEM_ICONS: Record<number, LucideIcon> = {
  1: Coffee,
  2: Package,
  3: Zap,
  4: BookOpen,
  5: Gift,
  6: Monitor,
  7: Award,
  8: Star,
};

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
// BalanceCard
// ─────────────────────────────────────────────

function BalanceCard({ user, points }: { user: UserRewards; points: number }) {
  const level = getLevel(points);
  const ptsToNext = level.nextPts === Infinity ? 0 : level.nextPts - points;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-ink text-surface p-6 shadow-md">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute -top-8 -right-8 w-40 h-40 rounded-full bg-gold opacity-15 blur-2xl" />
      <div className="pointer-events-none absolute bottom-0 left-8 w-28 h-28 rounded-full bg-brand opacity-10 blur-xl" />

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Avatar + name + level badge */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="shrink-0 w-12 h-12 rounded-full bg-brand/20 flex items-center justify-center text-xl font-bold select-none">
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt={user.username} className="w-full h-full rounded-full object-cover" />
            ) : (
              user.username.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-surface/50 leading-none mb-0.5">Welcome back,</p>
            <p className="font-semibold text-surface leading-tight truncate">{user.username}</p>
            <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${level.badgeClass}`}>
              {level.emoji} {level.name}
            </span>
          </div>
        </div>

        {/* Points balance — re-animates on change via key */}
        <div className="shrink-0 text-right">
          <p className="text-xs text-surface/50 uppercase tracking-wider mb-0.5">Points Balance</p>
          <AnimatePresence mode="wait">
            <motion.p
              key={points}
              initial={{ scale: 1.25, color: "#E2C044" }}
              animate={{ scale: 1, color: "#FFFFFF" }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="text-3xl font-extrabold leading-none"
            >
              {points.toLocaleString()}
            </motion.p>
          </AnimatePresence>
          <p className="text-xs text-surface/40 mt-0.5">pts</p>
        </div>
      </div>

      {/* Level progress bar */}
      {level.nextPts !== Infinity ? (
        <div className="relative mt-5">
          <div className="flex justify-between text-xs text-surface/50 mb-1.5">
            <span>{level.emoji} {level.name}</span>
            <span>{ptsToNext.toLocaleString()} pts to next level</span>
          </div>
          <div className="h-2 rounded-full bg-surface/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gold"
              initial={{ width: 0 }}
              animate={{ width: `${level.progress}%` }}
              transition={{
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
                delay: 0.2,
              }}
            />
          </div>
          <p className="text-right text-xs text-surface/40 mt-1">{level.progress}% to {LEVELS[LEVELS.findIndex(l => l.name === level.name) + 1]?.name ?? "max"}</p>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 text-gold text-sm font-medium">
          <Star size={14} className="fill-gold" />
          <span>Maximum level reached — you&apos;re a Legend! 🎉</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// RedemptionItemCard
// ─────────────────────────────────────────────

function RedemptionItemCard({
  item,
  canAfford,
  onRedeem,
}: {
  item: RedemptionItem;
  canAfford: boolean;
  onRedeem: (item: RedemptionItem) => void;
}) {
  const Icon = ITEM_ICONS[item.id] ?? Gift;
  const catCfg = CATEGORY_CONFIG[item.category];
  const lowStock = item.stock_remaining > 0 && item.stock_remaining <= 5;
  const outOfStock = item.stock_remaining === 0;

  return (
    <motion.div
      variants={cardVariants}
      className="group bg-surface rounded-2xl p-5 shadow-sm border border-border flex flex-col gap-3 hover:-translate-y-0.5 hover:shadow-md transition-[transform,box-shadow] duration-200"
    >
      {/* Icon + category pill */}
      <div className="flex items-start justify-between gap-2">
        <div className="w-12 h-12 rounded-xl bg-gold-light flex items-center justify-center text-gold shrink-0">
          <Icon size={22} />
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${catCfg.pill}`}>
          {catCfg.label}
        </span>
      </div>

      {/* Name + description */}
      <div className="flex-1">
        <h3 className="font-semibold text-ink leading-snug mb-1">{item.name}</h3>
        <p className="text-xs text-ink-muted leading-relaxed line-clamp-2">{item.description}</p>
      </div>

      {/* Footer: cost + stock + button */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
        <div>
          <div className="flex items-center gap-1 text-gold font-bold text-sm">
            <Coins size={13} />
            <span>{item.points_cost.toLocaleString()} pts</span>
          </div>
          <p
            className={`text-xs mt-0.5 ${
              outOfStock ? "text-alert" : lowStock ? "text-gold" : "text-ink-faint"
            }`}
          >
            {outOfStock
              ? "Out of stock"
              : lowStock
              ? `Only ${item.stock_remaining} left!`
              : `${item.stock_remaining} available`}
          </p>
        </div>
        <button
          disabled={!canAfford || outOfStock}
          onClick={() => onRedeem(item)}
          className={[
            "shrink-0 text-sm font-medium px-4 py-2 rounded-full transition-all duration-150",
            canAfford && !outOfStock
              ? "bg-gold text-ink hover:bg-gold/80 active:scale-95"
              : "bg-border text-ink-faint cursor-not-allowed",
          ].join(" ")}
        >
          {!canAfford && !outOfStock ? "Need more pts" : "Redeem"}
        </button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// CheckoutDialog
// ─────────────────────────────────────────────

type CheckoutState = "confirm" | "success";

function CheckoutDialog({
  item,
  open,
  userPoints,
  onClose,
  onConfirm,
}: {
  item: RedemptionItem | null;
  open: boolean;
  userPoints: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [step, setStep] = useState<CheckoutState>("confirm");

  function handleConfirm() {
    setStep("success");
    onConfirm(); // optimistic point deduction in parent
    setTimeout(() => {
      onClose();
      setStep("confirm"); // reset for next open (fires after dialog unmounts)
    }, 1600);
  }

  if (!item) return null;

  const Icon = ITEM_ICONS[item.id] ?? Gift;
  const remaining = userPoints - item.points_cost;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed z-50 inset-0 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              duration: 0.2,
              ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
            }}
            className="bg-surface rounded-2xl shadow-xl w-full max-w-sm p-6 relative"
          >
            {step === "confirm" && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-full text-ink-muted hover:bg-canvas transition-colors"
              >
                <X size={16} />
              </button>
            )}

            <AnimatePresence mode="wait">
              {step === "confirm" ? (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-4"
                >
                  {/* Item summary */}
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gold-light flex items-center justify-center text-gold shrink-0">
                      <Icon size={22} />
                    </div>
                    <div>
                      <Dialog.Title className="font-semibold text-ink leading-snug">
                        {item.name}
                      </Dialog.Title>
                      <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Cost breakdown */}
                  <div className="rounded-xl bg-canvas p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Cost</span>
                      <span className="font-semibold text-gold">
                        − {item.points_cost.toLocaleString()} pts
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2">
                      <span className="text-ink-muted">Remaining balance</span>
                      <span className="font-semibold text-ink">
                        {remaining.toLocaleString()} pts
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleConfirm}
                    className="w-full py-3 rounded-full bg-gold text-ink font-semibold hover:bg-gold/80 active:scale-95 transition-all duration-150"
                  >
                    Confirm Redemption
                  </button>
                  <button
                    onClick={onClose}
                    className="w-full py-2 text-sm text-ink-muted hover:text-ink transition-colors"
                  >
                    Cancel
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-4 py-4 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="w-16 h-16 rounded-full bg-success-light flex items-center justify-center text-success"
                  >
                    <CheckCircle2 size={32} />
                  </motion.div>
                  <div>
                    <p className="font-bold text-ink text-lg">Redeemed!</p>
                    <p className="text-sm text-ink-muted mt-1">
                      <span className="font-semibold text-gold">
                        − {item.points_cost.toLocaleString()} pts
                      </span>{" "}
                      deducted from your balance.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function RewardsPage() {
  const [user, setUser]               = useState<UserRewards | null>(null);
  const [items, setItems]             = useState<RedemptionItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [points, setPoints]           = useState(0);
  const [activeCategory, setActiveCategory] = useState<ItemCategory | "all">("all");
  const [selectedItem, setSelectedItem]     = useState<RedemptionItem | null>(null);
  const [dialogOpen, setDialogOpen]         = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (!authUser) { setLoading(false); return; }
      Promise.all([
        supabase
          .from("profiles")
          .select("username, avatar_url, points_balance, total_points_earned")
          .eq("id", authUser.id)
          .single(),
        supabase
          .from("redemption_items")
          .select("*")
          .eq("is_active", true)
          .order("points_cost"),
      ]).then(([{ data: profile }, { data: itemsData }]) => {
        if (profile) {
          setUser(profile as UserRewards);
          setPoints((profile as UserRewards).points_balance);
        }
        if (itemsData) setItems(itemsData as RedemptionItem[]);
        setLoading(false);
      });
    });
  }, []);

  const filteredItems =
    activeCategory === "all"
      ? items
      : items.filter((i) => i.category === activeCategory);

  function handleRedeem(item: RedemptionItem) {
    setSelectedItem(item);
    setDialogOpen(true);
  }

  function handleConfirm() {
    if (!selectedItem) return;
    // Optimistic deduction — triggers the gold flash on the balance card
    setPoints((prev) => prev - selectedItem.points_cost);
    // TODO: await supabase.rpc("redeem_item", { p_user_id: userId, p_item_id: selectedItem.id })
  }

  function handleClose() {
    setDialogOpen(false);
    setTimeout(() => setSelectedItem(null), 200);
  }

  if (loading) {
    return (
      <div className="min-h-full bg-canvas px-4 pt-6 pb-16 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-extrabold text-ink">Rewards Store</h1>
            <p className="text-sm text-ink-muted mt-1">Spend your points on exclusive perks ✨</p>
          </div>
          <div className="h-36 rounded-2xl bg-canvas animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 rounded-2xl bg-canvas animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-full bg-canvas flex items-center justify-center">
        <p className="text-sm text-ink-muted">Please log in to view rewards.</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-canvas px-4 pt-6 pb-16 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Rewards Store</h1>
          <p className="text-sm text-ink-muted mt-1">
            Spend your points on exclusive perks ✨
          </p>
        </div>

        {/* Balance hero */}
        <BalanceCard user={user} points={points} />

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-2">
          {(["all", "physical", "virtual", "booking"] as const).map((cat) => {
            const active = activeCategory === cat;
            const label = cat === "all" ? "All Items" : CATEGORY_CONFIG[cat].label;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={[
                  "text-sm font-medium px-4 py-2 rounded-full border transition-colors duration-150",
                  active
                    ? "bg-ink text-surface border-ink"
                    : "bg-surface text-ink-muted border-border hover:border-ink-faint hover:text-ink",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Items grid — re-staggers on category change via key */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredItems.map((item) => (
              <RedemptionItemCard
                key={item.id}
                item={item}
                canAfford={points >= item.points_cost}
                onRedeem={handleRedeem}
              />
            ))}
          </motion.div>
        </AnimatePresence>

        {filteredItems.length === 0 && !loading && (
          <div className="text-center py-16 text-ink-muted">
            <Gift size={32} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No items in this category yet.</p>
          </div>
        )}
      </div>

      {/* Checkout dialog */}
      <CheckoutDialog
        item={selectedItem}
        open={dialogOpen}
        userPoints={points}
        onClose={handleClose}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
