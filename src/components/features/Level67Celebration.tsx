"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getLevelNumber } from "@/lib/levels";
import { PROFILE_STATS_DIRTY_EVENT } from "@/lib/profile-sync";
import { createClient } from "@/utils/supabase/client";

const TARGET_LEVEL = 67;
const CELEBRATION_DURATION_MS = 5200;
const DIGIT_COUNT = 44;

type RainDigit = {
  id: number;
  value: "6" | "7";
  left: number;
  delay: number;
  duration: number;
  size: number;
  startX: number;
  endX: number;
  rotate: number;
  rotateDrift: number;
  opacity: number;
  blur: number;
};

function buildRainDigits(): RainDigit[] {
  return Array.from({ length: DIGIT_COUNT }, (_, id) => ({
    id,
    value: Math.random() > 0.5 ? "6" : "7",
    left: 2 + Math.random() * 96,
    delay: Math.random() * 0.9,
    duration: 2.8 + Math.random() * 2.2,
    size: 28 + Math.random() * 40,
    startX: -32 + Math.random() * 64,
    endX: -72 + Math.random() * 144,
    rotate: -18 + Math.random() * 36,
    rotateDrift: -30 + Math.random() * 60,
    opacity: 0.45 + Math.random() * 0.45,
    blur: Math.random() > 0.75 ? 0.9 : 0,
  }));
}

export default function Level67Celebration() {
  const supabase = useMemo(() => createClient(), []);

  const [isCelebrating, setIsCelebrating] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [digits, setDigits] = useState<RainDigit[]>([]);
  const [burstId, setBurstId] = useState(0);

  const userIdRef = useRef<string | null>(null);
  const profileChannelRef = useRef<RealtimeChannel | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const previousExpRef = useRef<number | null>(null);
  const watchRequestRef = useRef(0);

  const triggerCelebration = useCallback(() => {
    if (!reducedMotion) {
      setDigits(buildRainDigits());
    }
    setBurstId((value) => value + 1);
    setIsCelebrating(true);

    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
    }

    hideTimerRef.current = window.setTimeout(() => {
      setIsCelebrating(false);
    }, CELEBRATION_DURATION_MS);
  }, [reducedMotion]);

  const handleExpChange = useCallback((nextExp: number) => {
    const safeExp = Number.isFinite(nextExp) ? Math.max(0, nextExp) : 0;
    const previousExp = previousExpRef.current;

    if (previousExp === null) {
      previousExpRef.current = safeExp;
      return;
    }

    const previousLevel = getLevelNumber(previousExp);
    const nextLevel = getLevelNumber(safeExp);

    if (previousLevel < TARGET_LEVEL && nextLevel >= TARGET_LEVEL) {
      triggerCelebration();
    }

    previousExpRef.current = safeExp;
  }, [triggerCelebration]);

  const syncProfileExp = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("exp")
      .eq("id", userId)
      .maybeSingle();

    handleExpChange(data?.exp ?? 0);
  }, [handleExpChange, supabase]);

  const disconnectProfileChannel = useCallback(() => {
    if (!profileChannelRef.current) return;
    void supabase.removeChannel(profileChannelRef.current);
    profileChannelRef.current = null;
  }, [supabase]);

  const watchProfile = useCallback(async (userId: string) => {
    const requestId = watchRequestRef.current + 1;
    watchRequestRef.current = requestId;
    userIdRef.current = userId;
    previousExpRef.current = null;
    disconnectProfileChannel();

    await syncProfileExp(userId);
    if (watchRequestRef.current !== requestId) return;

    const channel = supabase
      .channel(`level-67-celebration-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => {
          const exp = (payload.new as { exp?: number | null }).exp ?? 0;
          handleExpChange(exp);
        }
      )
      .subscribe();

    profileChannelRef.current = channel;
  }, [disconnectProfileChannel, handleExpChange, supabase, syncProfileExp]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotionPreference = () => setReducedMotion(mediaQuery.matches);

    applyMotionPreference();
    mediaQuery.addEventListener("change", applyMotionPreference);

    return () => {
      mediaQuery.removeEventListener("change", applyMotionPreference);
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!isActive || !user) return;
      void watchProfile(user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null;

      if (!nextUserId) {
        watchRequestRef.current += 1;
        userIdRef.current = null;
        previousExpRef.current = null;
        disconnectProfileChannel();
        return;
      }

      if (userIdRef.current === nextUserId) return;
      void watchProfile(nextUserId);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
      disconnectProfileChannel();
    };
  }, [disconnectProfileChannel, supabase, watchProfile]);

  useEffect(() => {
    const onDirtyProfileStats = () => {
      if (!userIdRef.current) return;
      void syncProfileExp(userIdRef.current);
    };

    window.addEventListener(PROFILE_STATS_DIRTY_EVENT, onDirtyProfileStats);

    return () => {
      window.removeEventListener(PROFILE_STATS_DIRTY_EVENT, onDirtyProfileStats);
    };
  }, [syncProfileExp]);

  useEffect(() => {
    const syncCurrentUser = () => {
      if (!userIdRef.current) return;
      void syncProfileExp(userIdRef.current);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncCurrentUser();
      }
    };

    window.addEventListener("focus", syncCurrentUser);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", syncCurrentUser);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [syncProfileExp]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  return (
    <AnimatePresence>
      {isCelebrating && (
        <motion.div
          key={burstId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="pointer-events-none fixed inset-0 z-[120] overflow-hidden"
          aria-hidden="true"
        >
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              background:
                "radial-gradient(circle at top, color-mix(in srgb, var(--color-gold) 26%, transparent) 0%, transparent 60%)",
            }}
          />

          {!reducedMotion &&
            digits.map((digit) => (
              <motion.span
                key={`${burstId}-${digit.id}`}
                className="absolute top-0 select-none font-black leading-none"
                style={{
                  left: `${digit.left}%`,
                  fontSize: `${digit.size}px`,
                  filter: `blur(${digit.blur}px)`,
                  textShadow:
                    digit.value === "6"
                      ? "0 10px 28px rgba(212, 164, 71, 0.38)"
                      : "0 10px 28px rgba(201, 123, 99, 0.34)",
                  color: digit.value === "6" ? "var(--color-gold)" : "var(--color-alert)",
                }}
                initial={{
                  y: "-18vh",
                  x: digit.startX,
                  rotate: digit.rotate,
                  opacity: 0,
                  scale: 0.88,
                }}
                animate={{
                  y: "118vh",
                  x: digit.endX,
                  rotate: digit.rotate + digit.rotateDrift,
                  opacity: [0, digit.opacity, digit.opacity * 0.9, 0],
                  scale: [0.88, 1, 1, 0.96],
                }}
                transition={{
                  duration: digit.duration,
                  delay: digit.delay,
                  ease: "linear",
                }}
              >
                {digit.value}
              </motion.span>
            ))}

          <div className="absolute inset-x-0 top-14 flex justify-center px-4 sm:top-[4.5rem]">
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{
                duration: reducedMotion ? 0.18 : 0.45,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="rounded-[1.75rem] border border-gold/35 bg-surface/88 px-5 py-3 text-center shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-md"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.38em] text-ink-muted">
                Level Up
              </p>
              <p className="mt-1 text-2xl font-black tracking-[0.22em] text-ink sm:text-3xl">
                67
              </p>
              <p className="mt-1 text-xs font-medium text-ink-muted sm:text-sm">
                The 6s and 7s have entered the chat.
              </p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
