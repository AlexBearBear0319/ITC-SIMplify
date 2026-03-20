"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, QrCode } from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Props = {
  open: boolean;
  /** Displayed below "QR Verification" in the top bar */
  locationName?: string;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful (real or demo) scan — caller opens next modal */
  onSuccess: () => void;
};

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function QRScannerModal({
  open,
  locationName,
  onOpenChange,
  onSuccess,
}: Props) {
  const [verified, setVerified] = useState(false);

  const handleAutoVerify = () => {
    setVerified(true);
    setTimeout(() => {
      setVerified(false);
      onOpenChange(false);
      onSuccess();
    }, 900);
  };

  const handleClose = () => {
    if (verified) return; // don't interrupt the success animation
    setVerified(false);
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-70 flex flex-col items-center justify-between bg-overlay/95 backdrop-blur-sm">

      {/* ── Top bar ── */}
      <div className="w-full flex items-center justify-between px-5 pt-12">
        <button
          onClick={handleClose}
          aria-label="Close scanner"
          className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={20} />
        </button>
        <div className="text-center">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">
            QR Verification
          </p>
          {locationName && (
            <p className="text-sm font-bold text-white mt-0.5">{locationName}</p>
          )}
        </div>
        {/* Spacer to balance the close button */}
        <div className="w-9" />
      </div>

      {/* ── Viewfinder ── */}
      <div className="flex flex-col items-center gap-6">
        <AnimatePresence mode="wait">
          {verified ? (
            /* Success flash */
            <motion.div
              key="verified"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1,    opacity: 1 }}
              className="w-64 h-64 rounded-2xl bg-success/20 border-2 border-success flex items-center justify-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 10, stiffness: 200 }}
              >
                <CheckCircle2 size={64} className="text-success" />
              </motion.div>
            </motion.div>
          ) : (
            /* Scanner viewfinder */
            <motion.div
              key="scanner"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1  }}
              className="relative w-64 h-64"
            >
              {/* ── Corner markers (QR-scanner style) ── */}
              <div className="absolute top-0 left-0   w-8 h-8 border-t-[3px] border-l-[3px] border-white rounded-tl-lg" />
              <div className="absolute top-0 right-0  w-8 h-8 border-t-[3px] border-r-[3px] border-white rounded-tr-lg" />
              <div className="absolute bottom-0 left-0  w-8 h-8 border-b-[3px] border-l-[3px] border-white rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-white rounded-br-lg" />

              {/* ── Animated scanning line ── */}
              <motion.div
                className="absolute left-3 right-3 h-0.5 rounded-full bg-brand"
                style={{ boxShadow: "0 0 10px 3px #B3D2D5" }}
                initial={{ top: 10 }}
                animate={{ top: [10, 246, 10] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
              />

              {/* ── QR code ghost icon (hint to user what to aim at) ── */}
              <div className="absolute inset-0 flex items-center justify-center opacity-15">
                <QrCode size={88} className="text-white" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Instruction text */}
        <div className="text-center px-10">
          {verified ? (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-semibold text-success"
            >
              Location verified! Taking you there…
            </motion.p>
          ) : (
            <p className="text-sm text-white/70 leading-relaxed">
              Point your camera at the QR code posted at this location to verify your physical presence.
            </p>
          )}
        </div>
      </div>

      {/* ── Bottom actions ── */}
      <div className="w-full px-6 pb-12 space-y-3">
        {!verified && (
          <>
            {/* Demo divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">
                Hackathon Demo
              </p>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <button
              onClick={handleAutoVerify}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand hover:bg-brand-dark text-ink font-semibold text-sm rounded-full transition-all duration-200 hover:shadow-lg active:scale-[0.98]"
            >
              <CheckCircle2 size={16} />
              Auto-Verify (Demo)
            </button>
          </>
        )}

        <button
          onClick={handleClose}
          className="w-full py-2.5 text-white/40 hover:text-white text-sm font-medium transition-colors text-center"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
