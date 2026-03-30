"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, Users, Coins, ChevronLeft, Zap } from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type StudyBuddyData = {
  topic: string;
  max_members: number;
  needs_power: boolean;
};

type Props = {
  open: boolean;
  locationName: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: StudyBuddyData) => Promise<void>;
  onBack?: () => void;
};

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function StudyBuddyModal({ open, locationName, onOpenChange, onSubmit, onBack }: Props) {
  const [topic,      setTopic]      = useState("");
  const [maxMembers, setMaxMembers] = useState(4);
  const [needsPower, setNeedsPower] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success,    setSuccess]    = useState(false);

  const reset = () => {
    setTopic("");
    setMaxMembers(4);
    setNeedsPower(true);
    setSuccess(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && !submitting) reset();
    onOpenChange(next);
  };

  const handleBack = () => {
    if (submitting) return;
    reset();
    if (onBack) {
      onBack();
      return;
    }
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    await onSubmit({ topic, max_members: maxMembers, needs_power: needsPower });
    setSuccess(true);
    setSubmitting(false);
    setTimeout(() => handleOpenChange(false), 1500);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-60 bg-overlay/50 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby="buddy-desc"
          className="fixed left-1/2 top-1/2 z-60 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 bg-surface rounded-2xl shadow-xl outline-none overflow-hidden"
        >
          <AnimatePresence mode="wait">
            {success ? (
              /* ── Success state ── */
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-12 px-8 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.1 }}
                  className="w-16 h-16 rounded-full bg-brand-faint flex items-center justify-center mb-4"
                >
                  <Users size={30} className="text-brand-dark" />
                </motion.div>
                <p className="text-lg font-bold text-ink">Group Created!</p>
                <p className="text-sm text-ink-muted mt-1">
                  Your study group is live at{" "}
                  <span className="font-semibold text-ink">{locationName}</span>.
                </p>
                <div className="flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-gold-light rounded-full border border-gold/30">
                  <Coins size={13} className="text-gold" />
                  <span className="text-sm font-bold text-gold">Points earned!</span>
                </div>
              </motion.div>
            ) : (
              /* ── Form state ── */
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {/* Header */}
                <div className="flex items-start justify-between p-6 pb-0">
                  <div>
                    {onBack && (
                      <button
                        type="button"
                        onClick={handleBack}
                        className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink transition-colors"
                      >
                        <ChevronLeft size={14} />
                        Back
                      </button>
                    )}
                    <Dialog.Title className="text-base font-bold text-ink">
                      Find Study Buddy
                    </Dialog.Title>
                    <p id="buddy-desc" className="text-xs text-ink-muted mt-0.5 truncate max-w-55">
                      {locationName}
                    </p>
                  </div>
                  <Dialog.Close className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-brand-faint transition-colors">
                    <X size={16} />
                  </Dialog.Close>
                </div>

                <div className="p-6 space-y-5">
                  {/* Topic */}
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-2">
                      What are you studying?{" "}
                      <span className="font-normal text-ink-faint">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g., Data Structures, Stats revision…"
                      maxLength={80}
                      className="w-full px-3 py-2.5 bg-canvas border border-border rounded-xl text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-colors"
                    />
                  </div>

                  {/* Group size */}
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-2">
                      Group Size
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setMaxMembers(Math.max(2, maxMembers - 1))}
                        className="w-9 h-9 rounded-full bg-canvas border border-border flex items-center justify-center text-ink-muted hover:text-ink hover:bg-brand-faint transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center text-xl font-bold text-ink">{maxMembers}</span>
                      <button
                        type="button"
                        onClick={() => setMaxMembers(Math.min(8, maxMembers + 1))}
                        className="w-9 h-9 rounded-full bg-canvas border border-border flex items-center justify-center text-ink-muted hover:text-ink hover:bg-brand-faint transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                      <span className="text-xs text-ink-faint">people max</span>
                    </div>
                  </div>

                  {/* Power seat toggle */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-canvas">
                    <div className="flex items-center gap-2">
                      <Zap size={15} className={needsPower ? "text-gold" : "text-ink-faint"} />
                      <div>
                        <p className="text-xs font-semibold text-ink leading-tight">Power seats needed?</p>
                        <p className="text-[10px] text-ink-faint mt-0.5">
                          {needsPower
                            ? `~${maxMembers * 2} outlet${maxMembers * 2 !== 1 ? "s" : ""} reserved`
                            : "No outlets reserved"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNeedsPower((v) => !v)}
                      className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${needsPower ? "bg-gold" : "bg-border"}`}
                      aria-pressed={needsPower}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-surface shadow transition-transform duration-200 ${needsPower ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-brand hover:bg-brand-dark text-ink font-semibold text-sm rounded-full transition-all duration-200 hover:shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <span className="animate-pulse">Creating group…</span>
                    ) : (
                      <>
                        <Users size={14} />
                        Create Group · Earn Points
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
