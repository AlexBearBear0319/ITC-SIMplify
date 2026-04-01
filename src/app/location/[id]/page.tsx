"use client";

import { use, useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import * as Tabs from "@radix-ui/react-tabs";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { awardPoints, POINT_ACTIONS, trackMissionProgress } from "@/lib/db/points";
import { leaveStudyGroup } from "@/lib/db/study-groups";
import QRScannerModal from "@/components/features/QRScannerModal";
import ActionChoiceModal from "@/components/features/ActionChoiceModal";
import StudyBuddyModal, { type StudyBuddyData } from "@/components/features/StudyBuddyModal";
import {
  ChevronLeft,
  QrCode,
  Share2,
  MapPin,
  Users,
  Clock,
  CheckCircle2,
  BookOpen,
  UserCircle,
  Coins,
  Plus,
  LogOut,
  AlertCircle,
  Trophy,
} from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type LocationStatus = "empty" | "busy" | "full";

type LocationDetail = {
  id: number;
  name: string;
  category: string | null;
  current_status: LocationStatus | null;
  image_url: string | null;
  coordinates_x: number | null;
  coordinates_y: number | null;
  description: string | null;
  total_seats: number | null;
  power_outlets: number | null;
  location_text: string | null;
};

type StatusLog = {
  id: number;
  status: string;
  created_at: string;
  profiles: { username: string };
};

type Review = {
  id: number;
  rating: number;
  comment: string;
  created_at: string;
  profiles: { username: string; avatar_url: string | null };
};

type StudyGroup = {
  id: number;
  host_id: string;
  subject: string;
  current_members: number;
  max_members: number;
  is_active: boolean;
  created_at: string;
  profiles: { username: string };
};

type ActiveSessionInfo = {
  id: number;
  location_id: number | null;
  check_in_time: string | null;
  duration_minutes: number;
  activity: string;
};

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────

const STATUS_CONFIG: Record<
  LocationStatus,
  { label: string; dot: string; text: string; bg: string; border: string; barWidth: string }
> = {
  empty: { label: "Empty", dot: "bg-success", text: "text-success", bg: "bg-success-light", border: "border-success/40",  barWidth: "w-1/5"  },
  busy:  { label: "Busy",  dot: "bg-gold",    text: "text-gold",    bg: "bg-gold-light",    border: "border-gold/40",    barWidth: "w-3/5"  },
  full:  { label: "Full",  dot: "bg-alert",   text: "text-alert",   bg: "bg-alert-light",   border: "border-alert/40",   barWidth: "w-full" },
};

const STATUS_UPDATE_OPTIONS: {
  value: LocationStatus;
  label: string;
  description: string;
  emoji: string;
  activeClasses: string;
  inactiveClasses: string;
}[] = [
  { value: "empty", label: "Empty", description: "Plenty of seats available", emoji: "🟢", activeClasses: "bg-success border-success text-ink shadow-md scale-[1.02]",    inactiveClasses: "bg-success-light border-success/30 text-success hover:scale-[1.01] hover:shadow-sm" },
  { value: "busy",  label: "Busy",  description: "Some seats taken",          emoji: "🟡", activeClasses: "bg-gold border-gold text-ink shadow-md scale-[1.02]",            inactiveClasses: "bg-gold-light border-gold/30 text-gold hover:scale-[1.01] hover:shadow-sm"         },
  { value: "full",  label: "Full",  description: "No seats available",        emoji: "🔴", activeClasses: "bg-alert border-alert text-surface shadow-md scale-[1.02]",      inactiveClasses: "bg-alert-light border-alert/30 text-alert hover:scale-[1.01] hover:shadow-sm"       },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins} min${mins > 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Returns true if a session is still within its duration window */
function isSessionExpired(session: ActiveSessionInfo): boolean {
  if (!session.check_in_time) return true;
  const expiresAt = new Date(session.check_in_time).getTime() + session.duration_minutes * 60_000;
  return Date.now() > expiresAt;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-px" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={s <= rating ? "text-gold" : "text-ink-faint"}>★</span>
      ))}
    </div>
  );
}

function CrowdMeter({ status }: { status: LocationStatus }) {
  const filled = status === "empty" ? 1 : status === "busy" ? 3 : 5;
  const color  = status === "empty" ? "bg-success" : status === "busy" ? "bg-gold" : "bg-alert";
  return (
    <div className="flex gap-1 items-center" aria-label={`Crowd level: ${status}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={`h-1.5 w-4 rounded-full transition-colors duration-300 ${i < filled ? color : "bg-surface/30"}`} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Animation variants
// ─────────────────────────────────────────────

const cardVariants    = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } } };
const containerVariants = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function LocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const locationId = Number(id);
  const supabase = useMemo(() => createClient(), []);

  const [location,       setLocation]       = useState<LocationDetail | null>(null);
  const [statusLogs,     setStatusLogs]     = useState<StatusLog[]>([]);
  const [reviews,        setReviews]        = useState<Review[]>([]);
  const [studyGroups,    setStudyGroups]    = useState<StudyGroup[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [activeStatus,   setActiveStatus]   = useState<LocationStatus>("empty");
  // Real occupancy from active_sessions (0 when unknown)
  const [seatsOccupied,  setSeatsOccupied]  = useState(0);
  const [qrOpen,             setQrOpen]             = useState(false);
  const [actionChoiceOpen,   setActionChoiceOpen]   = useState(false);
  const [studyBuddyOpen,     setStudyBuddyOpen]     = useState(false);
  const [submitState,    setSubmitState]    = useState<"idle" | "submitting" | "done">("idle");
  const [pointsDelta,    setPointsDelta]    = useState<number | null>(null);
  const [currentUserId,  setCurrentUserId]  = useState<string | null>(null);
  const [checkInDone,    setCheckInDone]    = useState(false);

  // Active session state (either solo or study-group)
  const [existingSession,  setExistingSession]  = useState<ActiveSessionInfo | null>(null);
  const [existingGroupId,  setExistingGroupId]  = useState<number | null>(null);   // study group
  const [alreadyEarnedToday, setAlreadyEarnedToday] = useState(false);
  const [endingSession,    setEndingSession]    = useState(false);
  const [newBadgeName,     setNewBadgeName]     = useState<string | null>(null);
  const [blockToast,       setBlockToast]       = useState<string | null>(null);

  // Auto-dismiss badge toast after 3 s
  useEffect(() => {
    if (!newBadgeName) return;
    const t = setTimeout(() => setNewBadgeName(null), 3000);
    return () => clearTimeout(t);
  }, [newBadgeName]);

  // ── Load everything ──────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ?? null;
      if (userId) setCurrentUserId(userId);
      if (userId) await supabase.rpc("check_and_unlock_achievements", { p_user_id: userId });

      const [locRes, logsRes, revsRes, groupsRes, sessionsRes] = await Promise.all([
        supabase.from("locations").select("id, name, category, current_status, image_url, coordinates_x, coordinates_y, description, total_seats, power_outlets, location_text").eq("id", locationId).single(),
        supabase.from("status_logs").select("id, status, created_at, profiles(username)").eq("location_id", locationId).order("created_at", { ascending: false }).limit(10),
        supabase.from("reviews").select("id, rating, comment, created_at, profiles(username, avatar_url)").eq("location_id", locationId).order("created_at", { ascending: false }),
        supabase.from("study_groups").select("id, host_id, subject, current_members, max_members, is_active, created_at, profiles(username)").eq("location_id", locationId).eq("is_active", true).order("created_at", { ascending: false }),
        supabase.from("active_sessions").select("seats_taken").eq("location_id", locationId).eq("is_active", true),
      ]);

      if (locRes.data) {
        const loc = locRes.data as LocationDetail;

        // Compute real occupancy from active_sessions
        const occupied = (sessionsRes.data ?? []).reduce(
          (sum: number, s: { seats_taken: number | null }) => sum + (s.seats_taken ?? 1), 0
        );
        setSeatsOccupied(occupied);

        // Auto-derive status from actual fill %
        const totalSeats = loc.total_seats ?? 0;
        const fillPct    = totalSeats > 0 ? (occupied / totalSeats) * 100 : 0;
        const derivedStatus: LocationStatus =
          fillPct === 0 ? "empty" : fillPct <= 60 ? "empty" : fillPct <= 90 ? "busy" : "full";

        setLocation(loc);
        setActiveStatus(derivedStatus);

        // Keep DB in sync if derived differs from stored
        if (derivedStatus !== (loc.current_status ?? "empty")) {
          supabase.from("locations").update({ current_status: derivedStatus }).eq("id", locationId);
        }
      }
      setStatusLogs((logsRes.data ?? []) as unknown as StatusLog[]);
      setReviews((revsRes.data ?? []) as unknown as Review[]);
      const rawGroups = (groupsRes.data ?? []) as unknown as StudyGroup[];
      if (rawGroups.length > 0) {
        const ids = rawGroups.map((g) => g.id);
        const { data: memberRows } = await supabase
          .from("study_group_members")
          .select("group_id, user_id")
          .in("group_id", ids);

        const memberSets: Record<number, Set<string>> = {};
        (memberRows ?? []).forEach((m: { group_id: number; user_id: string }) => {
          if (!memberSets[m.group_id]) memberSets[m.group_id] = new Set();
          memberSets[m.group_id].add(m.user_id);
        });

        const normalized = rawGroups.map((g) => {
          const set = memberSets[g.id] ?? new Set<string>();
          if (g.host_id) set.add(g.host_id);
          const capacity    = Math.max(1, g.max_members);
          const memberCount = Math.min(capacity, Math.max(1, set.size || g.current_members));
          return { ...g, current_members: memberCount };
        });

        setStudyGroups(normalized as StudyGroup[]);
      } else {
        setStudyGroups([]);
      }

      // ── Check for any existing active session for this user ──
      if (userId) {
        // 1. Solo active_session
        const { data: soloSession } = await supabase
          .from("active_sessions")
          .select("id, location_id, check_in_time, duration_minutes, activity")
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle();

        if (soloSession && !isSessionExpired(soloSession as ActiveSessionInfo)) {
          setExistingSession(soloSession as ActiveSessionInfo);
        } else if (soloSession && isSessionExpired(soloSession as ActiveSessionInfo)) {
          // Auto-expire stale session
          await supabase.from("active_sessions").update({ is_active: false }).eq("id", soloSession.id);
        }

        // 2. Active study group membership
        const { data: memberships } = await supabase
          .from("study_group_members")
          .select("group_id")
          .eq("user_id", userId);
        if (memberships?.length) {
          const { data: activeGroup } = await supabase
            .from("study_groups")
            .select("id")
            .eq("is_active", true)
            .in("id", memberships.map((m: { group_id: number }) => m.group_id))
            .maybeSingle();
          if (activeGroup) setExistingGroupId(activeGroup.id);
        }

        // 3. Daily cooldown: has this user already done a check-in today?
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { count } = await supabase
          .from("active_sessions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("check_in_time", todayStart.toISOString());
        if ((count ?? 0) > 0) setAlreadyEarnedToday(true);
      }

      setLoading(false);
    }
    load();
  }, [locationId, supabase]);

  // ── Real-time subscription to active_sessions changes ──────────
  useEffect(() => {
    const channel = supabase
      .channel(`active_sessions:location_id=eq.${locationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "active_sessions",
          filter: `location_id=eq.${locationId}`,
        },
        async (payload) => {
          console.log("[Realtime Update] Active sessions changed:", payload);
          // Refetch active sessions to recalculate occupancy
          const { data: sessions } = await supabase
            .from("active_sessions")
            .select("seats_taken")
            .eq("location_id", locationId)
            .eq("is_active", true);

          if (sessions) {
            const occupied = sessions.reduce(
              (sum: number, s: any) => sum + (s.seats_taken ?? 1),
              0
            );
            console.log("[Realtime Update] New seats occupied:", occupied);
            setSeatsOccupied(occupied);

            const totalSeats = location?.total_seats ?? 0;
            const fillPct = totalSeats > 0 ? (occupied / totalSeats) * 100 : 0;
            const derivedStatus: LocationStatus =
              fillPct === 0 ? "empty" : fillPct <= 60 ? "empty" : fillPct <= 90 ? "busy" : "full";

            setActiveStatus(derivedStatus);
            setLocation((prev) => (prev ? { ...prev, current_status: derivedStatus } : prev));

            if (location && derivedStatus !== (location.current_status ?? "empty")) {
              void supabase.from("locations").update({ current_status: derivedStatus }).eq("id", locationId);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log("[Realtime] Subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [location?.current_status, location?.total_seats, locationId, supabase]);
  const handleEndSession = useCallback(async () => {
    if (!existingSession && !existingGroupId) return;
    setEndingSession(true);

    const wasGroup = !!existingGroupId;

    if (existingGroupId && currentUserId) {
      await leaveStudyGroup(supabase, existingGroupId, currentUserId);
      supabase.from("activity_log").insert({
        user_id: currentUserId,
        type: "group",
        description: `Left a study group at ${location?.name ?? "a study spot"}`,
      });
      setExistingGroupId(null);
    }

    if (existingSession) {
      await supabase.from("active_sessions").update({ is_active: false }).eq("id", existingSession.id);
      if (!wasGroup && currentUserId) {
        supabase.from("activity_log").insert({
          user_id: currentUserId,
          type: "checkin",
          description: `Checked out from ${location?.name ?? "a study spot"}`,
        });
      }
      setExistingSession(null);
    }

    setCheckInDone(false);
    setEndingSession(false);
  }, [existingSession, existingGroupId, currentUserId, supabase, location]);

  // ── Study Buddy creation ──────────────────────────────────
  const handleStudyBuddyCreate = useCallback(async (data: StudyBuddyData) => {
    if (!currentUserId) return { error: "Missing user." };

    // Hard guard: one active session at a time (solo or group)
    const { count: activeSessionCount } = await supabase
      .from("active_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", currentUserId)
      .eq("is_active", true);
    if ((activeSessionCount ?? 0) > 0 || existingSession || existingGroupId) {
      const msg = "You are already in an active session. Please leave it first.";
      return { error: msg };
    }

    const { data: activeMembership } = await supabase
      .from("study_group_members")
      .select("group_id, study_groups(is_active)")
      .eq("user_id", currentUserId)
      .limit(1)
      .maybeSingle();

    if (activeMembership && (activeMembership as any).study_groups?.is_active) {
      const msg = "You are already in an active session. Please leave it first.";
      return { error: msg };
    }

    // Create the study group (expires in 2 hours)
    const expiresAt = new Date(Date.now() + data.duration_minutes * 60_000).toISOString();
    const { data: group, error: groupError } = await supabase
      .from("study_groups")
      .insert({
        host_id:         currentUserId,
        location_id:     locationId,
        subject:         data.topic || "Study Session",
        max_members:     data.max_members,
        current_members: 1,
        is_active:       true,
        expires_at:      expiresAt,
      })
      .select("id")
      .single();

    if (groupError || !group) return { error: groupError?.message ?? "Failed to create group." };

    // Add creator as first member
    await supabase.from("study_group_members").insert({
      group_id: group.id,
      user_id:  currentUserId,
    });

    // Create active_sessions row so seat count is reflected; capture ID so host can leave later
    const { data: newSession } = await supabase.from("active_sessions").insert({
      user_id:          currentUserId,
      location_id:      locationId,
      activity:         "study_group",
      module:           data.topic || null,
      duration_minutes: data.duration_minutes,
      seats_taken:      1,
      needs_power:      data.needs_power,
      is_active:        true,
    }).select("id, location_id, check_in_time, duration_minutes, activity").single();

    setCheckInDone(true);
    setExistingGroupId(group.id);
    if (newSession) setExistingSession(newSession as ActiveSessionInfo);

    // Award points (daily cooldown applies)
    if (!alreadyEarnedToday) {
      const { data: rule } = await supabase
        .from("point_rules")
        .select("points_awarded")
        .eq("action_name", POINT_ACTIONS.CREATE_STUDY_GROUP)
        .eq("is_active", true)
        .maybeSingle();
      const pts = (rule as { points_awarded: number } | null)?.points_awarded ?? 20;

      await awardPoints(supabase, currentUserId, POINT_ACTIONS.CREATE_STUDY_GROUP);
      trackMissionProgress(supabase, currentUserId, POINT_ACTIONS.CREATE_STUDY_GROUP);

      // Update streak + unlock achievements + log activity
      await supabase.rpc("update_streak", { p_user_id: currentUserId });
      const { data: gBefore } = await supabase
        .from("user_achievements").select("achievement_id").eq("user_id", currentUserId);
      const gBeforeIds = new Set((gBefore ?? []).map((r: { achievement_id: number }) => r.achievement_id));
      await supabase.rpc("check_and_unlock_achievements", { p_user_id: currentUserId });
      const { data: gAfter } = await supabase
        .from("user_achievements").select("achievement_id, achievements(name)").eq("user_id", currentUserId);
      const gNewlyUnlocked = (gAfter ?? []).filter((r: { achievement_id: number }) => !gBeforeIds.has(r.achievement_id));
      if (gNewlyUnlocked.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setNewBadgeName((gNewlyUnlocked[0] as any).achievements?.name ?? "Badge");
        // Log each newly unlocked badge to activity history
        for (const badge of gNewlyUnlocked) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          supabase.from("activity_log").insert({ user_id: currentUserId, type: "badge", description: `Unlocked badge: ${(badge as any).achievements?.name ?? "Badge"}` });
        }
      }
      supabase.from("activity_log").insert({
        user_id:     currentUserId,
        type:        "group",
        description: `Created a study group at ${location?.name ?? "a study spot"}`,
      });

      setPointsDelta(pts);
      setTimeout(() => setPointsDelta(null), 2500);
      setAlreadyEarnedToday(true);
      try { sessionStorage.setItem("simplify_points_dirty", "1"); } catch { /* ignore */ }
    }
  }, [currentUserId, locationId, supabase, existingSession, existingGroupId, alreadyEarnedToday, location]);

  // ── Status update ─────────────────────────────────────────
  const handleStatusUpdate = async (newStatus: LocationStatus) => {
    if (!location || newStatus === activeStatus) return;
    setSubmitState("submitting");
    await supabase.from("status_logs").insert({ location_id: locationId, user_id: currentUserId, status: newStatus });
    await supabase.from("locations").update({ current_status: newStatus }).eq("id", locationId);
    setActiveStatus(newStatus);
    setStatusLogs((prev) => [
      { id: Date.now(), status: newStatus, created_at: new Date().toISOString(), profiles: { username: "you" } },
      ...prev,
    ]);
    setSubmitState("done");
    setTimeout(() => setSubmitState("idle"), 2000);
  };

  // ── Solo Check-in ─────────────────────────────────────────
  const handleCheckIn = useCallback(async (_scannedLocationId: number) => {
    if (!currentUserId) return;

    // Guard: one active session at a time
    if (existingSession || existingGroupId) {
      // QRScannerModal has already been dismissed; the UI button is disabled anyway
      return;
    }

    // Create active session and keep the real session id for reliable check-out.
    const { data: newSession, error: createSessionError } = await supabase
      .from("active_sessions")
      .insert({
        user_id:          currentUserId,
        location_id:      locationId,
        seats_taken:      1,
        activity:         "solo_study",
        duration_minutes: 60,
        needs_power:      false,
        is_active:        true,
      })
      .select("id, location_id, check_in_time, duration_minutes, activity")
      .single();

    if (createSessionError || !newSession) {
      console.error("[check-in] Failed to create active session:", createSessionError?.message);
      setBlockToast("Check-in failed. Please try again.");
      setTimeout(() => setBlockToast(null), 4000);
      return;
    }

    // Mark as checked in locally
    setCheckInDone(true);
    setExistingSession(newSession as ActiveSessionInfo);

    // Daily cooldown: only award points + update streak once per day
    if (!alreadyEarnedToday) {
      const { data: rule } = await supabase
        .from("point_rules")
        .select("points_awarded")
        .eq("action_name", POINT_ACTIONS.CHECK_IN)
        .eq("is_active", true)
        .maybeSingle();
      const pts = (rule as { points_awarded: number } | null)?.points_awarded ?? 10;

      await awardPoints(supabase, currentUserId, POINT_ACTIONS.CHECK_IN);
      trackMissionProgress(supabase, currentUserId, POINT_ACTIONS.CHECK_IN);

      // Update streak (RPC handles consecutive-day logic and duplicate-day guard)
      await supabase.rpc("update_streak", { p_user_id: currentUserId });

      // Detect newly unlocked achievements
      const { data: before } = await supabase
        .from("user_achievements").select("achievement_id").eq("user_id", currentUserId);
      const beforeIds = new Set((before ?? []).map((r: { achievement_id: number }) => r.achievement_id));
      await supabase.rpc("check_and_unlock_achievements", { p_user_id: currentUserId });
      const { data: after } = await supabase
        .from("user_achievements").select("achievement_id, achievements(name)").eq("user_id", currentUserId);
      const newlyUnlocked = (after ?? []).filter((r: { achievement_id: number }) => !beforeIds.has(r.achievement_id));
      if (newlyUnlocked.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setNewBadgeName((newlyUnlocked[0] as any).achievements?.name ?? "Badge");
        for (const badge of newlyUnlocked) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          supabase.from("activity_log").insert({ user_id: currentUserId, type: "badge", description: `Unlocked badge: ${(badge as any).achievements?.name ?? "Badge"}` });
        }
      }

      // Write activity log (fire-and-forget)
      supabase.from("activity_log").insert({
        user_id:     currentUserId,
        type:        "checkin",
        description: `Checked in at ${location?.name ?? "a study spot"}`,
      });

      setPointsDelta(pts);
      setTimeout(() => setPointsDelta(null), 2500);
      setAlreadyEarnedToday(true);

      // Signal profile page to refresh its points counter
      try { sessionStorage.setItem("simplify_points_dirty", "1"); } catch { /* ignore */ }
    }
  }, [currentUserId, locationId, supabase, existingSession, existingGroupId, alreadyEarnedToday, location]);

  if (loading || !location) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-56 bg-surface border border-border rounded-2xl animate-pulse" />
        <div className="h-14 bg-surface border border-border rounded-2xl animate-pulse" />
        <div className="h-64 bg-surface border border-border rounded-2xl animate-pulse" />
      </div>
    );
  }

  const s = STATUS_CONFIG[activeStatus];
  const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  // Is the user currently blocked from checking in?
  const isBlocked = !!(existingSession || existingGroupId);
  const blockReason = existingGroupId
    ? "You're in an active study group session. Leave it first."
    : existingSession
    ? existingSession.location_id === locationId
      ? "You're already checked in here."
      : "You have an active session at another location."
    : null;

  return (
    <>
      <QRScannerModal
        open={qrOpen}
        locationName={location.name}
        onOpenChange={(open) => { if (!open) setQrOpen(false); }}
        onSuccess={() => { setQrOpen(false); setActionChoiceOpen(true); }}
        requiredLocationId={locationId}
      />

      <ActionChoiceModal
        open={actionChoiceOpen}
        locationName={location.name}
        onClose={() => setActionChoiceOpen(false)}
        onCheckIn={() => { setActionChoiceOpen(false); handleCheckIn(locationId); }}
        onStudyBuddy={() => { setActionChoiceOpen(false); setStudyBuddyOpen(true); }}
        isUserCheckedIn={!!existingSession}
      />

      <StudyBuddyModal
        open={studyBuddyOpen}
        locationName={location.name}
        onOpenChange={(open) => { if (!open) setStudyBuddyOpen(false); }}
        onSubmit={handleStudyBuddyCreate}
      />

      {/* Badge unlock toast — auto-dismisses after 3 s */}
      <AnimatePresence>
        {newBadgeName && (
          <motion.div
            key="badge-toast"
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: -16, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-gold text-ink text-xs font-semibold px-4 py-2 rounded-full shadow-lg pointer-events-none whitespace-nowrap"
          >
            <Trophy size={13} />
            Badge unlocked: {newBadgeName}!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating +pts animation */}
      <AnimatePresence>
        {pointsDelta !== null && (
          <motion.div
            key="pts-delta"
            initial={{ opacity: 1, y: 0, scale: 0.9 }}
            animate={{ opacity: 0, y: -60, scale: 1.15 }}
            transition={{ duration: 2.2, ease: "easeOut" }}
            className="fixed top-24 right-4 z-50 flex items-center gap-1.5 bg-gold text-ink font-bold text-base px-4 py-2 rounded-full shadow-lg pointer-events-none"
          >
            <Coins size={16} />
            +{pointsDelta} pts
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={containerVariants} initial="hidden" animate="show">

        {/* ── Hero Banner ── */}
        <motion.div variants={cardVariants}>
          <div className="relative h-56 md:h-72 w-full overflow-hidden">
            {location.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={location.image_url} alt={location.name} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-linear-to-br from-brand via-brand-dark to-[#6BA8B4]" />
            )}
            <div className="absolute inset-0 bg-linear-to-t from-ink/65 via-ink/15 to-transparent" />

            <Link href="/location" className="absolute top-4 left-4 flex items-center gap-1.5 bg-surface/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium text-ink border border-border/50 hover:bg-surface transition-colors shadow-sm">
              <ChevronLeft size={13} />
              Back
            </Link>

            <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {location.category && (
                  <span className="px-2.5 py-0.5 bg-surface/90 backdrop-blur-sm rounded-full text-xs font-semibold text-ink-muted border border-border/50">{location.category}</span>
                )}
                <CrowdMeter status={activeStatus} />
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${s.bg} ${s.text} border ${s.border}`}>● {s.label}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-surface leading-tight">{location.name}</h1>
              <p className="text-sm text-surface/75 mt-1 flex items-center gap-1.5">
                <MapPin size={12} className="shrink-0" />
                {[location.location_text, location.total_seats ? `Capacity ${location.total_seats}` : null].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Availability Summary (Always Visible) ── */}
        {location.total_seats && (
          <motion.div variants={cardVariants} className="grid grid-cols-1 gap-3 px-4 md:px-6 mb-2">
            {location.total_seats && (
              <div className="bg-surface rounded-2xl border border-border p-4 shadow-sm">
                <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider mb-2">Study Seats</p>
                <p className="text-xl font-bold text-ink">
                  {location.total_seats - seatsOccupied}
                  <span className="text-xs text-ink-muted font-normal">/{location.total_seats}</span>
                </p>
                <p className="text-[10px] text-ink-muted mt-1">left available</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Sticky Action Bar ── */}
        <div className="sticky top-16 z-10 bg-surface/95 backdrop-blur-md border-b border-border/80">
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-2 flex items-center gap-2">
            {/* Scan QR — disabled when user already has an active session */}
            <button
              onClick={() => {
                if (isBlocked || checkInDone) {
                  const msg = blockReason ?? "Leave your existing session first.";
                  setBlockToast(msg);
                  setTimeout(() => setBlockToast(null), 4000);
                  return;
                }
                setQrOpen(true);
              }}
              aria-disabled={isBlocked || checkInDone}
              title={blockReason ?? undefined}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand hover:bg-brand-dark text-ink font-semibold text-sm rounded-full transition-all duration-200 hover:shadow-sm active:scale-[0.98] ${
                isBlocked || checkInDone ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {checkInDone ? (
                <><CheckCircle2 size={16} /> Checked In</>
              ) : (
                <><QrCode size={16} /> Scan QR to Enter</>
              )}
            </button>

            <button aria-label="Share location" className="p-2.5 bg-canvas border border-border rounded-full text-ink-muted hover:text-ink hover:bg-brand-faint transition-colors duration-200">
              <Share2 size={16} />
            </button>
          </div>
        </div>

        {/* Block toast for disabled check-in */}
        <AnimatePresence>
          {blockToast && (
            <motion.div
              key="block-toast"
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0,  scale: 1    }}
              exit={{    opacity: 0, y: -8, scale: 0.97 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-start gap-2.5 bg-ink text-surface text-sm font-medium px-4 py-3 rounded-2xl shadow-xl max-w-sm w-[calc(100vw-2rem)]"
            >
              <AlertCircle size={16} className="text-gold shrink-0 mt-0.5" />
              {blockToast}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Page Body ── */}
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-3 pb-5 md:pt-4 md:pb-6 space-y-4">

          {/* Blocked — existing session elsewhere */}
          <AnimatePresence>
            {isBlocked && !checkInDone && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-3 px-4 py-3.5 bg-gold-light border border-gold/30 rounded-2xl"
              >
                <AlertCircle size={16} className="text-gold shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">Session already active</p>
                  <p className="text-xs text-ink-muted mt-0.5">{blockReason}</p>
                </div>
                {(existingGroupId || (existingSession && existingSession.location_id === locationId)) && (
                  <button
                    onClick={handleEndSession}
                    disabled={endingSession}
                    className="shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-full bg-alert-light text-alert border border-alert/30 hover:bg-alert/20 transition-colors disabled:opacity-50"
                  >
                    <LogOut size={12} />
                    {endingSession ? "Leaving…" : existingGroupId ? "Leave Group" : "End Session"}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Checked-in success banner */}
          <AnimatePresence>
            {checkInDone && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 px-4 py-3 bg-success-light border border-success/30 rounded-2xl"
              >
                <CheckCircle2 size={16} className="text-success shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-ink">
                    {existingGroupId ? "Study group created!" : `Checked in at ${location.name}!`}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {alreadyEarnedToday && !pointsDelta
                      ? "Points already earned today — come back tomorrow."
                      : existingGroupId
                      ? "Points awarded. Group active for 2 hours."
                      : "Points awarded. Session valid for 60 min."}
                  </p>
                </div>
                <button
                  onClick={handleEndSession}
                  disabled={endingSession}
                  className="shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-full bg-alert-light text-alert border border-alert/30 hover:bg-alert/20 transition-colors disabled:opacity-50"
                >
                  <LogOut size={12} />
                  {endingSession ? "Leaving…" : existingGroupId ? "Leave Group" : "Check Out"}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Already earned today warning (shown when not blocked but cooldown active) */}
          <AnimatePresence>
            {alreadyEarnedToday && !isBlocked && !checkInDone && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 px-4 py-3 bg-brand-faint border border-brand/20 rounded-2xl"
              >
                <Coins size={15} className="text-brand-dark shrink-0" />
                <p className="text-xs text-ink-muted">
                  You&apos;ve already earned check-in points today. You can still check in but no extra points.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {location.description && (
            <motion.p variants={cardVariants} className="text-sm text-ink-muted leading-relaxed">
              {location.description}
            </motion.p>
          )}

          {/* ── Tabs ── */}
          <motion.div variants={cardVariants}>
            <Tabs.Root defaultValue="live-status">
              <Tabs.List className="flex gap-1 p-1 bg-canvas rounded-xl border border-border mb-5">
                {[
                  { value: "live-status", label: "Live Status",       icon: <Clock size={13} />   },
                  { value: "reviews",     label: "Reviews & Buddies", icon: <BookOpen size={13} /> },
                ].map(({ value, label, icon }) => (
                  <Tabs.Trigger
                    key={value} value={value}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg text-ink-muted transition-all duration-200 data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-sm hover:text-ink"
                  >
                    {icon}{label}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>

              {/* ── Live Status tab ── */}
              <Tabs.Content value="live-status" className="space-y-5 outline-none">
                <div className={`bg-surface rounded-2xl border ${s.border} p-5 shadow-sm`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-ink-faint uppercase tracking-widest">Current Occupancy</p>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>● {s.label}</span>
                  </div>
                  {/* Real occupancy bar based on active_sessions vs total_seats */}
                  {location.total_seats ? (
                    <>
                      <div className="h-3 bg-canvas rounded-full overflow-hidden border border-border">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${s.dot}`}
                          style={{ width: `${Math.min(100, Math.round((seatsOccupied / location.total_seats) * 100))}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-ink-faint mt-1.5 mb-2">
                        <span>{seatsOccupied} occupied</span>
                        <span>{location.total_seats} total</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="h-3 bg-canvas rounded-full overflow-hidden border border-border">
                        <div className={`h-full rounded-full transition-all duration-700 ${s.dot} ${s.barWidth}`} />
                      </div>
                      <div className="flex justify-between text-[10px] text-ink-faint mt-1.5">
                        <span>Empty</span><span>Full</span>
                      </div>
                    </>
                  )}
                  {seatsOccupied > 0 && (
                    <p className="text-[11px] text-ink-muted mt-2">
                      {activeStatus === "full"
                        ? "No seats available — try another spot."
                        : activeStatus === "busy"
                        ? "Some seats left but getting busy."
                        : "Plenty of seats available."}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-ink-muted mb-3 flex items-center gap-1.5">
                    <Coins size={12} className="text-gold" />
                    Update crowd status · Earn <span className="text-gold font-bold">+10 pts</span>
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {STATUS_UPDATE_OPTIONS.map(({ value, label, description, emoji, activeClasses, inactiveClasses }) => (
                      <button
                        key={value}
                        onClick={() => handleStatusUpdate(value)}
                        disabled={submitState === "submitting"}
                        className={`relative flex flex-col items-center gap-1.5 p-4 rounded-2xl border-2 text-center font-semibold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed ${activeStatus === value ? activeClasses : inactiveClasses}`}
                      >
                        <span className="text-xl leading-none">{emoji}</span>
                        <span className="text-sm">{label}</span>
                        <span className="text-[10px] font-normal opacity-75 leading-tight">{description}</span>
                        {activeStatus === value && <span className="absolute top-2 right-2"><CheckCircle2 size={13} /></span>}
                      </button>
                    ))}
                  </div>
                  {submitState === "submitting" && <p className="text-xs text-ink-muted text-center mt-3 animate-pulse">Saving…</p>}
                  {submitState === "done"       && <p className="text-xs text-success text-center mt-3 font-medium">✓ Status updated!</p>}
                </div>

                {statusLogs.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-ink-faint uppercase tracking-widest mb-3">Recent Updates</p>
                    <div className="space-y-2">
                      {statusLogs.map((log) => {
                        const logStatus = (log.status as LocationStatus) in STATUS_CONFIG ? (log.status as LocationStatus) : "empty";
                        const logS = STATUS_CONFIG[logStatus];
                        return (
                          <div key={log.id} className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${logS.dot}`} />
                            <div className="flex-1 min-w-0">
                              <span className={`text-xs font-semibold ${logS.text}`}>{logS.label}</span>
                              <span className="text-xs text-ink-muted ml-1.5">by <span className="font-medium text-ink">@{log.profiles.username}</span></span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-ink-faint shrink-0">
                              <Clock size={10} />{timeAgo(log.created_at)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Tabs.Content>

              {/* ── Reviews & Buddies tab ── */}
              <Tabs.Content value="reviews" className="space-y-6 outline-none">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-ink-faint uppercase tracking-widest">Active Study Groups</p>
                    <Link href={`/finder?locationId=${locationId}`} className="flex items-center gap-1 text-xs font-medium text-brand-dark hover:text-ink transition-colors">
                      <Plus size={12} />Create group
                    </Link>
                  </div>
                  {studyGroups.length === 0 ? (
                    <div className="text-center py-8 text-sm text-ink-muted bg-surface rounded-2xl border border-border">
                      No study groups here yet.{" "}
                      <Link href={`/finder?locationId=${locationId}`} className="text-brand-dark font-medium">Start one!</Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {studyGroups.map((group) => {
                        const spotsLeft = group.max_members - group.current_members;
                        const full = spotsLeft === 0;
                        return (
                          <div key={group.id} className="flex items-center gap-3 p-4 bg-surface rounded-2xl border border-border hover:border-brand transition-colors duration-200">
                            <div className="w-10 h-10 rounded-xl bg-brand-faint flex items-center justify-center shrink-0">
                              <BookOpen size={16} className="text-brand-dark" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-ink truncate leading-tight">{group.subject}</p>
                              <p className="text-xs text-ink-muted mt-0.5 flex items-center gap-1.5"><UserCircle size={11} />Host: @{group.profiles.username}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="flex items-center gap-1 text-xs text-ink-muted mb-1.5"><Users size={11} />{group.current_members}/{group.max_members}</div>
                              <Link
                                href={`/finder?locationId=${locationId}`}
                                className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${full ? "bg-canvas text-ink-faint border border-border pointer-events-none" : "bg-brand hover:bg-brand-dark text-ink"}`}
                              >
                                {full ? "Full" : `Join (${spotsLeft} left)`}
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-ink-faint uppercase tracking-widest">Reviews</p>
                    {reviews.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-ink-muted">
                        <span className="text-gold">★</span>
                        <span className="font-semibold text-ink">{avgRating.toFixed(1)}</span>
                        <span>· {reviews.length} reviews</span>
                      </div>
                    )}
                  </div>
                  {reviews.length === 0 ? (
                    <div className="text-center py-8 text-sm text-ink-muted bg-surface rounded-2xl border border-border">No reviews yet. Be the first!</div>
                  ) : (
                    <div className="space-y-3">
                      {reviews.map((review) => (
                        <div key={review.id} className="p-4 bg-surface rounded-2xl border border-border">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-brand-light flex items-center justify-center text-xs font-bold text-ink shrink-0">
                                {review.profiles.username[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-ink leading-tight">@{review.profiles.username}</p>
                                <StarRating rating={review.rating} />
                              </div>
                            </div>
                            <span className="text-[10px] text-ink-faint shrink-0 flex items-center gap-1 mt-0.5"><Clock size={10} />{timeAgo(review.created_at)}</span>
                          </div>
                          <p className="text-sm text-ink-muted leading-relaxed">{review.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Tabs.Content>
            </Tabs.Root>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}
