"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Gift,
  QrCode,
  Ticket,
} from "lucide-react";
import RewardQrCode from "@/components/features/RewardQrCode";
import { createClient } from "@/utils/supabase/client";
import {
  buildRewardClaimPayload,
  getRewardStatusLabel,
  isRewardCollected,
  isRewardPending,
} from "@/lib/reward-claims";

type RewardPass = {
  id: number;
  redeemed_at: string;
  status: string | null;
  claim_token: string | null;
  claimed_at: string | null;
  redemption_items: {
    name: string;
    description: string | null;
    category: string | null;
  } | null;
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MyRewardsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [passes, setPasses] = useState<RewardPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openPassId, setOpenPassId] = useState<number | null>(null);

  const loadPasses = useCallback(
    async (knownUserId?: string) => {
      let currentUserId = knownUserId ?? userId;

      if (!currentUserId) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          window.location.href = "/auth/login";
          return;
        }

        currentUserId = user.id;
        setUserId(user.id);
      }

      const { data, error: fetchError } = await supabase
        .from("user_redemptions")
        .select(
          "id, redeemed_at, status, claim_token, claimed_at, redemption_items(name, description, category)",
        )
        .eq("user_id", currentUserId)
        .order("redeemed_at", { ascending: false });

      if (fetchError) {
        if (/claim_token|claimed_at/i.test(fetchError.message)) {
          setError(
            "This feature needs the reward-claim SQL migration to be run in Supabase first.",
          );
        } else {
          setError(fetchError.message);
        }
        setLoading(false);
        return;
      }

      const nextPasses = (data ?? []) as unknown as RewardPass[];
      setPasses(nextPasses);
      setError(null);
      setLoading(false);

      // Keep the currently open pass open only if it's still pending.
      // Do NOT auto-open any pass — the user must click "Show QR" explicitly.
      setOpenPassId((current) => {
        if (current && nextPasses.some((pass) => pass.id === current && isRewardPending(pass.status))) {
          return current;
        }
        return null;
      });
    },
    [supabase, userId],
  );

  useEffect(() => {
    void loadPasses();
  }, [loadPasses]);

  useEffect(() => {
    if (!userId || !passes.some((pass) => isRewardPending(pass.status))) return;

    const intervalId = window.setInterval(() => {
      void loadPasses(userId);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [loadPasses, passes, userId]);

  const pendingCount = passes.filter((pass) => isRewardPending(pass.status)).length;
  const collectedCount = passes.filter((pass) => isRewardCollected(pass.status)).length;

  if (loading) {
    return (
      <div className="min-h-full bg-canvas px-4 pt-6 pb-16 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="h-8 w-32 rounded-lg bg-surface border border-border animate-pulse" />
          <div className="h-32 rounded-2xl bg-surface border border-border animate-pulse" />
          <div className="h-56 rounded-2xl bg-surface border border-border animate-pulse" />
          <div className="h-56 rounded-2xl bg-surface border border-border animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-canvas px-4 pt-6 pb-16 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Profile
        </Link>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="bg-surface rounded-2xl border border-border shadow-sm p-5"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-ink mb-1">
                <Ticket size={18} className="text-gold" />
                <h1 className="text-xl font-extrabold text-ink">My Rewards</h1>
              </div>
              <p className="text-sm text-ink-muted max-w-2xl">
                Open a pending reward pass and show its QR code to IT Club staff during collection.
                The status will update automatically after it has been scanned.
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold-light text-gold text-xs font-semibold">
                <Clock size={12} />
                {pendingCount} pending
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success-light text-success text-xs font-semibold">
                <CheckCircle2 size={12} />
                {collectedCount} collected
              </span>
            </div>
          </div>
        </motion.section>

        {error && (
          <div className="rounded-2xl border border-alert/30 bg-alert-light px-4 py-3 text-sm text-alert">
            {error}
          </div>
        )}

        {!error && passes.length === 0 && (
          <div className="bg-surface rounded-2xl border border-border shadow-sm p-10 text-center">
            <Gift size={30} className="mx-auto mb-3 text-ink-faint" />
            <p className="text-base font-semibold text-ink">No rewards redeemed yet</p>
            <p className="text-sm text-ink-muted mt-1">
              Visit the rewards store to redeem your first item.
            </p>
            <Link
              href="/rewards"
              className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-full bg-brand text-ink font-semibold text-sm hover:bg-brand-dark transition-colors"
            >
              <Gift size={14} />
              Browse Rewards
            </Link>
          </div>
        )}

        {!error &&
          passes.map((pass, index) => {
            const pending = isRewardPending(pass.status);
            const collected = isRewardCollected(pass.status);
            const qrOpen = pending && openPassId === pass.id && !!pass.claim_token;

            return (
              <motion.section
                key={pass.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.04,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="bg-surface rounded-2xl border border-border shadow-sm p-5"
              >
                <div className="flex flex-col xl:flex-row gap-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          collected
                            ? "bg-success-light text-success"
                            : pending
                            ? "bg-gold-light text-gold"
                            : "bg-alert-light text-alert"
                        }`}
                      >
                        {collected ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        {getRewardStatusLabel(pass.status)}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-canvas text-ink-muted text-xs font-medium border border-border">
                        Reward ID #{pass.id}
                      </span>
                      {pass.redemption_items?.category && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-faint text-brand-dark text-xs font-medium border border-brand/20">
                          {pass.redemption_items.category}
                        </span>
                      )}
                    </div>

                    <h2 className="text-lg font-bold text-ink leading-tight">
                      {pass.redemption_items?.name ?? "Unknown reward"}
                    </h2>
                    <p className="text-sm text-ink-muted mt-1.5 leading-relaxed">
                      {pass.redemption_items?.description || "No description provided for this reward."}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                      <div className="rounded-xl bg-canvas border border-border px-3 py-2.5">
                        <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-widest">
                          Redeemed On
                        </p>
                        <p className="text-sm font-medium text-ink mt-1">
                          {formatDateTime(pass.redeemed_at)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-canvas border border-border px-3 py-2.5">
                        <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-widest">
                          Collection Status
                        </p>
                        <p className="text-sm font-medium text-ink mt-1">
                          {getRewardStatusLabel(pass.status)}
                        </p>
                        {collected && pass.claimed_at && (
                          <p className="text-xs text-ink-faint mt-1">
                            Collected on {formatDateTime(pass.claimed_at)}
                          </p>
                        )}
                      </div>
                    </div>

                    {pending && (
                      <div className="mt-4 space-y-3">
                        <div className="rounded-xl bg-gold-light border border-gold/30 px-3.5 py-3">
                          <p className="text-xs font-semibold text-ink">
                            Show your QR pass to IT Club staff when collecting this reward.
                          </p>
                          <p className="text-[11px] text-ink-muted mt-1">
                            Staff will scan it to mark the reward as collected automatically.
                          </p>
                        </div>

                        {pass.claim_token ? (
                          <button
                            onClick={() =>
                              setOpenPassId((current) => (current === pass.id ? null : pass.id))
                            }
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand text-ink text-sm font-semibold hover:bg-brand-dark transition-colors"
                          >
                            <QrCode size={14} />
                            {qrOpen ? "Hide QR Pass" : "Show QR Pass"}
                          </button>
                        ) : (
                          <div className="rounded-xl bg-alert-light border border-alert/30 px-3.5 py-3 text-sm text-alert">
                            QR pass unavailable. Run the reward-claim SQL migration, then reload this page.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {qrOpen && pass.claim_token && (
                    <div className="xl:w-[260px] shrink-0 flex flex-col items-center gap-3 xl:pt-1">
                      <RewardQrCode value={buildRewardClaimPayload(pass.claim_token)} />
                      <p className="text-xs text-center text-ink-muted leading-relaxed max-w-[220px]">
                        Reward ID #{pass.id}. Keep this pass private until you are ready to collect.
                      </p>
                    </div>
                  )}
                </div>
              </motion.section>
            );
          })}
      </div>
    </div>
  );
}
