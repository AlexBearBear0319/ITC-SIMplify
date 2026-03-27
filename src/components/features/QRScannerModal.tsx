"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, QrCode, AlertCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getLocationByQRToken } from "@/lib/db/locations";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Props = {
  open: boolean;
  locationName?: string;
  onOpenChange: (open: boolean) => void;
  /** Called after the user scans a valid location QR code — passes the matched location's id */
  onSuccess: (locationId: number) => void;
  /** If provided, the scanned QR must belong to this specific location */
  requiredLocationId?: number;
};

type ScanStatus = "scanning" | "verified" | "error";

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function QRScannerModal({
  open,
  locationName,
  onOpenChange,
  onSuccess,
  requiredLocationId,
}: Props) {
  const supabase   = useMemo(() => createClient(), []);
  const [status,   setStatus]   = useState<ScanStatus>("scanning");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Holds stop/pause/resume handles for the live scanner instance
  const scannerRef = useRef<{
    stop:   () => Promise<void>;
    pause:  () => void;
    resume: () => void;
  } | null>(null);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
  }, []);

  // Start / stop the camera whenever `open` changes
  useEffect(() => {
    if (!open) {
      stopScanner();
      setStatus("scanning");
      setErrorMsg(null);
      return;
    }

    let cancelled = false;

    // Delay ensures the modal DOM element is mounted before we query it
    const timer = setTimeout(async () => {
      if (cancelled || !document.getElementById("qr-live-region")) return;

      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        const scanner = new Html5Qrcode("qr-live-region");

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10 },          // no qrbox — full-frame scan, our corner markers are decorative
          async (decodedText) => {
            // Pause immediately so the same code isn't validated twice
            scanner.pause();

            const { data: location } = await getLocationByQRToken(supabase, decodedText);

            if (location) {
              // If requiredLocationId is set, verify the QR belongs to this spot
              if (requiredLocationId !== undefined && location.id !== requiredLocationId) {
                scanner.resume();
                setStatus("error");
                setErrorMsg("Wrong location QR. Scan the QR code posted at this spot.");
                setTimeout(() => setStatus((s) => s === "error" ? "scanning" : s), 3000);
                return;
              }
              await scanner.stop().catch(() => {});
              scannerRef.current = null;
              setStatus("verified");
              setTimeout(() => {
                setStatus("scanning");
                onOpenChange(false);
                onSuccess(location.id);
              }, 900);
            } else {
              // Invalid QR — resume so user can try another code
              scanner.resume();
              setStatus("error");
              setErrorMsg("Invalid QR code. Scan the QR posted at this location.");
              // Auto-clear error after 3 s
              setTimeout(() => setStatus((s) => s === "error" ? "scanning" : s), 3000);
            }
          },
          () => {
            // Per-frame decode failures are normal (no QR visible) — ignore
          }
        );

        scannerRef.current = {
          stop:   () => scanner.stop(),
          pause:  () => scanner.pause(),
          resume: () => scanner.resume(),
        };
      } catch {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg("Could not start camera. Please allow camera access and try again.");
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopScanner();
    };
  }, [open, supabase, onOpenChange, onSuccess, stopScanner, requiredLocationId]);

  const handleClose = () => {
    if (status === "verified") return;
    onOpenChange(false);
  };

  const handleRetry = () => {
    scannerRef.current?.resume();
    setStatus("scanning");
    setErrorMsg(null);
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
        <div className="w-9" />
      </div>

      {/* ── Viewfinder ── */}
      <div className="flex flex-col items-center gap-6">
        <AnimatePresence mode="wait">
          {status === "verified" ? (
            /* Success state */
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
            /* Live camera + overlays */
            <motion.div
              key="scanner-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative w-64 h-64"
            >
              {/* html5-qrcode renders the <video> inside this element */}
              <div
                id="qr-live-region"
                className="w-full h-full rounded-2xl overflow-hidden bg-ink/60 [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
              />

              {/* Corner marker overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0   w-8 h-8 border-t-[3px] border-l-[3px] border-white rounded-tl-lg" />
                <div className="absolute top-0 right-0  w-8 h-8 border-t-[3px] border-r-[3px] border-white rounded-tr-lg" />
                <div className="absolute bottom-0 left-0  w-8 h-8 border-b-[3px] border-l-[3px] border-white rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-white rounded-br-lg" />

                {/* Animated scanning line */}
                {status === "scanning" && (
                  <motion.div
                    className="absolute left-3 right-3 h-0.5 rounded-full bg-brand"
                    style={{ boxShadow: "0 0 10px 3px #B3D2D5" }}
                    initial={{ top: 10 }}
                    animate={{ top: [10, 246, 10] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
                  />
                )}
              </div>

              {/* Error overlay — shown on top of the still-running camera */}
              {status === "error" && (
                <div className="absolute inset-0 rounded-2xl bg-alert/30 border-2 border-alert flex items-center justify-center">
                  <AlertCircle size={48} className="text-alert" />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status text */}
        <div className="text-center px-10">
          {status === "verified" ? (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-semibold text-success"
            >
              Location verified! Taking you there…
            </motion.p>
          ) : status === "error" ? (
            <p className="text-sm text-alert font-medium leading-relaxed">{errorMsg}</p>
          ) : (
            <p className="text-sm text-white/70 leading-relaxed">
              Point your camera at the QR code posted at this location to verify your
              physical presence.
            </p>
          )}
        </div>
      </div>

      {/* ── Bottom actions ── */}
      <div className="w-full px-6 pb-12 space-y-3">
        {status === "error" && (
          <button
            onClick={handleRetry}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand hover:bg-brand-dark text-ink font-semibold text-sm rounded-full transition-all duration-200 hover:shadow-lg active:scale-[0.98]"
          >
            <QrCode size={16} />
            Try Again
          </button>
        )}
        {status !== "verified" && (
          <button
            onClick={handleClose}
            className="w-full py-2.5 text-white/40 hover:text-white text-sm font-medium transition-colors text-center"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
