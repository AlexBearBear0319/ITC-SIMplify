"use client";

import { motion } from "framer-motion";
import { X, LogIn, Users } from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Props = {
  open: boolean;
  locationName: string;
  onClose: () => void;
  onCheckIn: () => void;
  onStudyBuddy: () => void;
};

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function ActionChoiceModal({
  open,
  locationName,
  onClose,
  onCheckIn,
  onStudyBuddy,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-overlay/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <motion.div
        className="relative w-full max-w-sm bg-surface rounded-t-3xl shadow-xl pb-10"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-brand-faint transition-colors"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="px-6 pt-3 pb-5">
          <p className="text-[11px] font-semibold text-brand-dark uppercase tracking-widest">
            QR Verified ✓
          </p>
          <h2 className="text-xl font-bold text-ink mt-1 leading-snug">{locationName}</h2>
          <p className="text-sm text-ink-muted mt-0.5">What would you like to do here?</p>
        </div>

        {/* Choices */}
        <div className="px-6 space-y-3">
          {/* Solo Check-in */}
          <button
            onClick={onCheckIn}
            className="w-full flex items-center gap-4 px-5 py-4 bg-brand hover:bg-brand-dark text-ink rounded-2xl transition-all duration-200 active:scale-[0.98] shadow-sm hover:shadow-md"
          >
            <div className="w-11 h-11 rounded-xl bg-ink/10 flex items-center justify-center shrink-0">
              <LogIn size={22} />
            </div>
            <div className="text-left">
              <p className="font-bold text-sm">Solo Check-in</p>
              <p className="text-xs opacity-70 mt-0.5">Reserve your seat · Earn points</p>
            </div>
          </button>

          {/* Find Study Buddy */}
          <button
            onClick={onStudyBuddy}
            className="w-full flex items-center gap-4 px-5 py-4 bg-canvas border border-border hover:bg-brand-faint hover:border-brand text-ink rounded-2xl transition-all duration-200 active:scale-[0.98]"
          >
            <div className="w-11 h-11 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
              <Users size={22} className="text-brand-dark" />
            </div>
            <div className="text-left">
              <p className="font-bold text-sm text-ink">Find Study Buddy</p>
              <p className="text-xs text-ink-muted mt-0.5">Create a group · Study together</p>
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
