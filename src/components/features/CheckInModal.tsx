"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, BookOpen, Coffee, CheckCircle2, Coins, ChevronLeft } from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Activity = "study" | "eating";

export type CheckInData = {
  seats_needed: number;
  activity: Activity;
  module: string;
  duration_minutes: number;
};

type Props = {
  open: boolean;
  locationName: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CheckInData) => Promise<void>;
  onBack?: () => void;
  defaultValues?: Partial<CheckInData>;
  editMode?: boolean;
};

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────

const DURATION_OPTIONS = [
  { label: "30 min", value: 30  },
  { label: "1 hour", value: 60  },
  { label: "2 hours", value: 120 },
  { label: "4 hours", value: 240 },
];

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function CheckInModal({ open, locationName, onOpenChange, onSubmit, onBack, defaultValues, editMode = false }: Props) {
  const [seatsNeeded, setSeatsNeeded] = useState(defaultValues?.seats_needed ?? 1);
  const [activity,    setActivity]    = useState<Activity>(defaultValues?.activity ?? "study");
  const [module,      setModule]      = useState(defaultValues?.module ?? "");
  const [duration,    setDuration]    = useState(defaultValues?.duration_minutes ?? 60);
  const [submitting,  setSubmitting]  = useState(false);
  const [success,     setSuccess]     = useState(false);

  const reset = () => {
    setSeatsNeeded(1);
    setActivity("study");
    setModule("");
    setDuration(60);
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
    await onSubmit({ seats_needed: seatsNeeded, activity, module, duration_minutes: duration });
    setSuccess(true);
    setSubmitting(false);
    setTimeout(() => handleOpenChange(false), 1500);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-60 bg-overlay/50 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby="checkin-desc"
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
                <p className="text-lg font-bold text-ink">{editMode ? "Session Updated!" : "Checked In!"}</p>
                <p className="text-sm text-ink-muted mt-1">
                  {editMode ? "Your session details have been updated." : (
                    <>Your session has started at{" "}<span className="font-semibold text-ink">{locationName}</span>.</>
                  )}
                </p>
                {!editMode && (
                  <div className="flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-gold-light rounded-full border border-gold/30">
                    <Coins size={13} className="text-gold" />
                    <span className="text-sm font-bold text-gold">+10 pts earned</span>
                  </div>
                )}
              </motion.div>
            ) : (
              /* ── Form state ── */
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {/* Header */}
                <div className="flex items-start justify-between p-6 pb-0">
                  <div>
                    {onBack && !editMode && (
                      <button
                        type="button"
                        onClick={handleBack}
                        className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink transition-colors"
                      >
                        <ChevronLeft size={14} />
                        Back
                      </button>
                    )}
                    <Dialog.Title className="text-base font-bold text-ink">{editMode ? "Edit Session" : "Check In"}</Dialog.Title>
                    <p id="checkin-desc" className="text-xs text-ink-muted mt-0.5 truncate max-w-55">
                      {locationName}
                    </p>
                  </div>
                  <Dialog.Close className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-brand-faint transition-colors">
                    <X size={16} />
                  </Dialog.Close>
                </div>

                <div className="p-6 space-y-5">
                  {/* Seats Needed */}
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-2">
                      Seats Needed
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setSeatsNeeded(Math.max(1, seatsNeeded - 1))}
                        className="w-9 h-9 rounded-full bg-canvas border border-border flex items-center justify-center text-ink-muted hover:text-ink hover:bg-brand-faint transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center text-xl font-bold text-ink">{seatsNeeded}</span>
                      <button
                        type="button"
                        onClick={() => setSeatsNeeded(Math.min(8, seatsNeeded + 1))}
                        className="w-9 h-9 rounded-full bg-canvas border border-border flex items-center justify-center text-ink-muted hover:text-ink hover:bg-brand-faint transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                      <span className="text-xs text-ink-faint">incl. bags / friends</span>
                    </div>
                  </div>

                  {/* Activity */}
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-2">Activity</label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { value: "study",  label: "Study",  Icon: BookOpen },
                        { value: "eating", label: "Eating", Icon: Coffee   },
                      ] as const).map(({ value, label, Icon }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setActivity(value)}
                          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-150 ${
                            activity === value
                              ? "bg-brand border-brand text-ink"
                              : "bg-canvas border-border text-ink-muted hover:border-brand hover:text-ink"
                          }`}
                        >
                          <Icon size={15} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Module — study only, animated */}
                  <AnimatePresence>
                    {activity === "study" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <label className="block text-xs font-semibold text-ink-muted mb-2">
                          Module / Subject{" "}
                          <span className="font-normal text-ink-faint">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={module}
                          onChange={(e) => setModule(e.target.value)}
                          placeholder="e.g., CS301 Data Structures"
                          maxLength={60}
                          className="w-full px-3 py-2.5 bg-canvas border border-border rounded-xl text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-colors"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Duration */}
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-2">Duration</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {DURATION_OPTIONS.map(({ label, value }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setDuration(value)}
                          className={`py-2 rounded-xl border text-xs font-semibold transition-all duration-150 ${
                            duration === value
                              ? "bg-brand border-brand text-ink"
                              : "bg-canvas border-border text-ink-muted hover:border-brand hover:text-ink"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
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
                      <span className="animate-pulse">{editMode ? "Saving…" : "Checking in…"}</span>
                    ) : editMode ? (
                      "Save Changes"
                    ) : (
                      <><Coins size={14} className="text-gold" /> Confirm Check-In · +10 pts</>
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
