"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, QrCode, X } from "lucide-react";
import { extractRewardClaimToken } from "@/lib/reward-claims";

type ClaimResult = {
  error: string | null;
  reward?: {
    id: number;
    name: string;
    username: string | null;
  } | null;
  alreadyClaimed?: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClaimToken: (token: string) => Promise<ClaimResult>;
};

type ScanStatus = "scanning" | "verifying" | "verified" | "error";

export default function RewardClaimScannerModal({
  open,
  onOpenChange,
  onClaimToken,
}: Props) {
  const [status, setStatus] = useState<ScanStatus>("scanning");
  const [message, setMessage] = useState<string | null>(null);

  const claimRef = useRef(onClaimToken);
  const closeRef = useRef(onOpenChange);
  const scannerRef = useRef<{
    stop: () => Promise<void>;
    pause: () => void;
    resume: () => void;
  } | null>(null);

  useEffect(() => {
    claimRef.current = onClaimToken;
  }, [onClaimToken]);

  useEffect(() => {
    closeRef.current = onOpenChange;
  }, [onOpenChange]);

  const stopScanner = useCallback(async () => {
    if (!scannerRef.current) return;

    await scannerRef.current.stop().catch(() => {});
    scannerRef.current = null;
  }, []);

  const startScanner = useCallback(async () => {
    if (!document.getElementById("reward-qr-live-region")) return;

    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = new Html5Qrcode("reward-qr-live-region");

    await scanner.start(
      { facingMode: "environment" },
      { fps: 10 },
      async (decodedText) => {
        scanner.pause();

        const claimToken = extractRewardClaimToken(decodedText);
        if (!claimToken) {
          setStatus("error");
          setMessage("That QR is not a valid reward collection pass.");
          return;
        }

        setStatus("verifying");
        setMessage("Verifying reward pass...");

        const result = await claimRef.current(claimToken);
        if (result.error) {
          setStatus("error");
          setMessage(result.error);
          return;
        }

        await scanner.stop().catch(() => {});
        scannerRef.current = null;

        const rewardLabel = result.reward
          ? `Reward #${result.reward.id} · ${result.reward.name}`
          : "Reward collected";

        setStatus("verified");
        setMessage(
          result.alreadyClaimed
            ? `${rewardLabel} was already collected.`
            : `${rewardLabel} marked as collected.`,
        );

        setTimeout(() => {
          setStatus("scanning");
          setMessage(null);
          closeRef.current(false);
        }, 1200);
      },
      () => {
        // Per-frame misses are expected while the camera searches for a QR.
      },
    );

    scannerRef.current = {
      stop: () => scanner.stop(),
      pause: () => scanner.pause(),
      resume: () => scanner.resume(),
    };
  }, []);

  useEffect(() => {
    if (!open) {
      void stopScanner();
      setStatus("scanning");
      setMessage(null);
      return;
    }

    let cancelled = false;

    const timer = setTimeout(() => {
      if (cancelled) return;
      startScanner().catch(() => {
        if (cancelled) return;
        setStatus("error");
        setMessage("Camera could not be started. Please allow camera access and try again.");
      });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      void stopScanner();
    };
  }, [open, startScanner, stopScanner]);

  const handleClose = () => {
    if (status === "verifying") return;
    onOpenChange(false);
  };

  const handleRetry = () => {
    if (scannerRef.current) {
      scannerRef.current.resume();
    } else {
      void startScanner().catch(() => {
        setStatus("error");
        setMessage("Camera could not be restarted. Please close and try again.");
      });
      return;
    }
    setStatus("scanning");
    setMessage(null);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-70 flex flex-col items-center justify-between bg-overlay/95 backdrop-blur-sm">
      <div className="w-full flex items-center justify-between px-5 pt-12">
        <button
          onClick={handleClose}
          aria-label="Close reward scanner"
          className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={20} />
        </button>
        <div className="text-center">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">
            Reward Pickup
          </p>
          <p className="text-sm font-bold text-white mt-0.5">Scan Student QR Pass</p>
        </div>
        <div className="w-9" />
      </div>

      <div className="flex flex-col items-center gap-6">
        <AnimatePresence mode="wait">
          {status === "verified" ? (
            <motion.div
              key="verified"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
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
            <motion.div
              key="scanner-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative w-64 h-64"
            >
              <div
                id="reward-qr-live-region"
                className="w-full h-full rounded-2xl overflow-hidden bg-ink/60 [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
              />

              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-white rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-white rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-white rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-white rounded-br-lg" />

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

              {status === "error" && (
                <div className="absolute inset-0 rounded-2xl bg-alert/30 border-2 border-alert flex items-center justify-center">
                  <AlertCircle size={48} className="text-alert" />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center px-10">
          {status === "verified" ? (
            <p className="text-sm font-semibold text-success">{message}</p>
          ) : status === "verifying" ? (
            <p className="text-sm text-brand font-medium leading-relaxed">{message}</p>
          ) : status === "error" ? (
            <p className="text-sm text-alert font-medium leading-relaxed">{message}</p>
          ) : (
            <p className="text-sm text-white/70 leading-relaxed">
              Scan the QR pass shown on the student&apos;s <span className="font-semibold text-white">My Rewards</span> page.
            </p>
          )}
        </div>
      </div>

      <div className="w-full px-6 pb-12 space-y-3">
        {status === "error" && (
          <button
            onClick={handleRetry}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand hover:bg-brand-dark text-ink font-semibold text-sm rounded-full transition-all duration-200 hover:shadow-lg active:scale-[0.98]"
          >
            <QrCode size={16} />
            Try Another QR
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
