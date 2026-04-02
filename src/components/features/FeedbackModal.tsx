"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, Coins } from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type CrowdStatus = "empty" | "busy" | "full";

export type FeedbackData = {
  crowd_status: CrowdStatus;
  rating: number;
  comment: string;
};

type Props = {
  open: boolean;
  locationName: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: FeedbackData) => Promise<void>;
};

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────

const CROWD_OPTIONS: {
  value: CrowdStatus;
  label: string;
  emoji: string;
  activeBg: string;
  activeText: string;
}[] = [
  { value: "empty", label: "Empty", emoji: "🟢", activeBg: "bg-success-light border-success/50", activeText: "text-success" },
  { value: "busy",  label: "Busy",  emoji: "🟡", activeBg: "bg-gold-light border-gold/50",      activeText: "text-gold"    },
  { value: "full",  label: "Full",  emoji: "🔴", activeBg: "bg-alert-light border-alert/50",    activeText: "text-alert"   },
];

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function FeedbackModal({ open, locationName, onOpenChange, onSubmit }: Props) {
  const [crowdStatus, setCrowdStatus] = useState<CrowdStatus | null>(null);
  const [rating,      setRating]      = useState(0);
  const [comment,     setComment]     = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [success,     setSuccess]     = useState(false);

  const isValid = crowdStatus !== null && rating >= 1;

  const reset = () => {
    setCrowdStatus(null);
    setRating(0);
    setComment("");
    setSuccess(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && !submitting) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    await onSubmit({ crowd_status: crowdStatus!, rating, comment });
    setSuccess(true);
    setSubmitting(false);
    setTimeout(() => handleOpenChange(false), 1600);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-60 bg-overlay/50 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby="feedback-desc"
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
                  className="w-16 h-16 rounded-full bg-success-light flex items-center justify-center mb-4"
                >
                  <CheckCircle2 size={30} className="text-success" />
                </motion.div>
                <p className="text-lg font-bold text-ink">Thanks for the update!</p>
                <p className="text-sm text-ink-muted mt-1">
                  Your feedback keeps the map accurate for everyone.
                </p>
                <div className="flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-gold-light rounded-full border border-gold/30">
                  <Coins size={13} className="text-gold" />
                  <span className="text-sm font-bold text-gold">+15 pts earned</span>
                </div>
              </motion.div>
            ) : (
              /* ── Form state ── */
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {/* Header */}
                <div className="flex items-start justify-between p-6 pb-0">
                  <div>
                    <Dialog.Title className="text-base font-bold text-ink">
                      How was your visit?
                    </Dialog.Title>
                    <p id="feedback-desc" className="text-xs text-ink-muted mt-0.5 truncate max-w-55">
                      {locationName}
                    </p>
                  </div>
                  <Dialog.Close className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-brand-faint transition-colors">
                    <X size={16} />
                  </Dialog.Close>
                </div>

                <div className="p-6 space-y-5">
                  {/* Crowd status */}
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-2">
                      How busy is it right now?{" "}
                      <span className="text-alert">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {CROWD_OPTIONS.map(({ value, label, emoji, activeBg, activeText }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setCrowdStatus(value)}
                          className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 font-semibold transition-all duration-150 ${
                            crowdStatus === value
                              ? `${activeBg} ${activeText}`
                              : "bg-canvas border-border text-ink-muted hover:border-brand hover:text-ink"
                          }`}
                        >
                          <span className="text-xl leading-none">{emoji}</span>
                          <span className="text-xs">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Comment */}
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-2">
                      Rate this spot{" "}
                      <span className="text-alert">*</span>
                    </label>
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((value) => {
                          const active = value <= rating;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setRating(value)}
                              className={`text-2xl leading-none transition-transform duration-150 hover:scale-110 ${
                                active ? "text-gold" : "text-border hover:text-gold/70"
                              }`}
                              aria-label={`Rate ${value} star${value > 1 ? "s" : ""}`}
                              title={`${value} star${value > 1 ? "s" : ""}`}
                            >
                              ★
                            </button>
                          );
                        })}
                      </div>
                      <span className="text-xs font-medium text-ink-muted min-w-20">
                        {rating > 0 ? `${rating}/5` : "Select rating"}
                      </span>
                    </div>
                  </div>

                  {/* Comment */}
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-2">
                      Leave a review{" "}
                      <span className="font-normal text-ink-faint">(optional)</span>
                    </label>
                    <textarea
                      rows={3}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="How was the noise level? Power outlets working? Tips for others?"
                      maxLength={200}
                      className="w-full px-3 py-2.5 bg-canvas border border-border rounded-xl text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-colors resize-none"
                    />
                    <p className="text-[10px] text-ink-faint text-right mt-1">
                      {comment.length}/200
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6">
                  <button
                    onClick={handleSubmit}
                    disabled={!isValid || submitting}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-brand hover:bg-brand-dark text-ink font-semibold text-sm rounded-full transition-all duration-200 hover:shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <span className="animate-pulse">Submitting…</span>
                    ) : (
                      <><Coins size={14} className="text-gold" /> Submit & Check Out · +15 pts</>
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
