"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import InteractiveMap from "@/components/features/InteractiveMap";
import CheckInModal, { type CheckInData } from "@/components/features/CheckInModal";
import FeedbackModal, { type FeedbackData } from "@/components/features/FeedbackModal";
import QRScannerModal from "@/components/features/QRScannerModal";
import ActionChoiceModal from "@/components/features/ActionChoiceModal";
import StudyBuddyModal, { type StudyBuddyData } from "@/components/features/StudyBuddyModal";
import { createClient } from "@/utils/supabase/client";
import { getLevelNumber } from "@/lib/levels";
import { trackMissionProgress, POINT_ACTIONS } from "@/lib/db/points";
import {
  MapPin,
  Flame,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Star,
  X,
  Target,
  Coins,
  LogIn,
  LogOut,
  Clock,
  Users,
  Zap,
  AlertCircle,
} from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Mission = {
  id: number;
  title: string;
  description: string;
  reward_points: number;
  progress: number;
  target_count: number;
  location_hint: string;
  target_action: string;
};

type LeaderboardEntry = {
  rank: number;
  name: string;
  initials: string;
  points: number;
  level: number;
};

type LocationStatus = "empty" | "busy" | "full";

type DashboardLocation = {
  id: number;
  name: string;
  category: string;
  current_status: LocationStatus;
  coordinates_x: number;
  coordinates_y: number;
  images: string[] | null;
  location_text: string | null;
  opening_time: string | null;
  total_seats: number | null;
  power_outlets: number | null;
  description: string | null;
};

type ActiveSession = {
  locationId: number;
  locationName: string;
  seats_needed: number;
  activity: "study" | "eating";
  module: string;
  duration_minutes: number;
  endsAt: Date;
};

type Review = {
  id: number;
  username: string;
  comment: string;
  created_at: string;
};

// The fields we need from the logged-in student's profile row
type DashboardProfile = {
  full_name: string | null;
  username: string | null;
  points: number;
  level: number;
  streak_days: number;
};

// ─────────────────────────────────────────────
// Config tables
// ─────────────────────────────────────────────

const FILTER_OPTIONS: {
  value: LocationStatus | null;
  label: string;
  active: string;
  inactive: string;
}[] = [
  {
    value: null,
    label: "All",
    active:   "bg-ink text-surface border-ink",
    inactive: "bg-surface text-ink-muted border-border hover:bg-brand-faint hover:text-ink",
  },
  {
    value: "empty",
    label: "🟢 Open",
    active:   "bg-success text-ink border-success",
    inactive: "bg-surface text-ink-muted border-border hover:bg-success-light hover:text-ink",
  },
  {
    value: "busy",
    label: "🟡 Busy",
    active:   "bg-gold text-ink border-gold",
    inactive: "bg-surface text-ink-muted border-border hover:bg-gold-light hover:text-ink",
  },
  {
    value: "full",
    label: "🔴 Full",
    active:   "bg-alert text-surface border-alert",
    inactive: "bg-surface text-ink-muted border-border hover:bg-alert-light hover:text-ink",
  },
];

const STATUS_CONFIG: Record<LocationStatus, { label: string; dot: string; text: string; bg: string }> = {
  empty: { label: "Open", dot: "bg-success", text: "text-success", bg: "bg-success-light" },
  busy:  { label: "Busy", dot: "bg-gold",    text: "text-gold",    bg: "bg-gold-light"    },
  full:  { label: "Full", dot: "bg-alert",   text: "text-alert",   bg: "bg-alert-light"   },
};

const RANK_STYLE: Record<number, { ring: string; badge: string; label: string }> = {
  1: { ring: "ring-gold",         badge: "bg-gold-light text-gold",      label: "🥇" },
  2: { ring: "ring-[#C0C0C0]",    badge: "bg-[#F4F4F4] text-[#888]",    label: "🥈" },
  3: { ring: "ring-[#CD7F32]/60", badge: "bg-[#FFF0E8] text-[#CD7F32]", label: "🥉" },
};

// ─────────────────────────────────────────────
// Animation variants
// ─────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 18 },
  show:   {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return { text: "Good Morning", emoji: "☀️" };
  if (h < 17) return { text: "Good Afternoon", emoji: "🌤️" };
  return { text: "Good Evening", emoji: "🌙" };
}

function timeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─────────────────────────────────────────────
// LocationDrawer — Google Maps-style bottom sheet
// ─────────────────────────────────────────────

function LocationDrawer({
  location,
  activeSession,
  reviews,
  onCheckIn,
  onLeaveSpot,
  onClose,
}: {
  location: DashboardLocation;
  activeSession: ActiveSession | null;
  reviews: Review[];
  onCheckIn: () => void;
  onLeaveSpot: () => void;
  onClose: () => void;
}) {
  const s = STATUS_CONFIG[location.current_status];
  const isMyActiveLocation = activeSession?.locationId === location.id;
  const hasImages = (location.images?.length ?? 0) > 0;
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    // Reset gallery index whenever user opens a different location.
    setActiveImageIndex(0);
  }, [location.id]);

  const totalImages = location.images?.length ?? 0;
  const currentImage = hasImages ? location.images![activeImageIndex] : null;

  const showPrevImage = () => {
    if (!hasImages || totalImages <= 1) return;
    setActiveImageIndex((prev) => (prev === 0 ? totalImages - 1 : prev - 1));
  };

  const showNextImage = () => {
    if (!hasImages || totalImages <= 1) return;
    setActiveImageIndex((prev) => (prev === totalImages - 1 ? 0 : prev + 1));
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-50 bg-overlay/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Bottom-sheet panel */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={location.name}
        className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl shadow-xl flex flex-col"
        style={{ maxHeight: "85vh" }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Body: left media stays static, right details scroll independently on desktop. */}
        <div className="flex-1 overflow-y-auto md:overflow-hidden px-4 pt-3 pb-8 md:px-5">
          <div className="h-full flex flex-col md:flex-row gap-4 md:gap-5">

            {/* ── Left: image gallery (static placement) ── */}
            <div className="md:w-[42%] md:max-w-md shrink-0">
              {hasImages && currentImage ? (
                <div className="relative rounded-xl overflow-hidden border border-border bg-canvas h-48 md:h-105">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentImage}
                    alt={`${location.name} photo ${activeImageIndex + 1}`}
                    className="w-full h-full object-cover"
                  />

                  {totalImages > 1 && (
                    <>
                      <button
                        onClick={showPrevImage}
                        aria-label="Previous image"
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-overlay/55 text-white flex items-center justify-center hover:bg-overlay/70 transition-colors"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        onClick={showNextImage}
                        aria-label="Next image"
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-overlay/55 text-white flex items-center justify-center hover:bg-overlay/70 transition-colors"
                      >
                        <ChevronRight size={16} />
                      </button>

                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-overlay/45">
                        {location.images!.map((_, i) => (
                          <span
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full ${i === activeImageIndex ? "bg-white" : "bg-white/45"}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-linear-to-br from-brand-faint to-brand/20 flex items-center justify-center h-48 md:h-105 border border-border">
                  <MapPin size={36} className="text-brand-dark opacity-30" />
                </div>
              )}
            </div>

            {/* ── Right: details (scrollable) ── */}
            <div className="flex-1 md:overflow-y-auto md:pr-1">

              {/* ── Header: status + name + close ── */}
              <div className="pt-1">
            <div className="flex items-start justify-between mb-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot} animate-pulse`} />
                Live · {s.label}
              </span>
              <button
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-brand-faint transition-colors -mt-1"
              >
                <X size={18} />
              </button>
            </div>

            <h2 className="text-xl font-bold text-ink leading-tight">{location.name}</h2>

            {location.location_text && (
              <p className="text-sm text-ink-muted mt-1 flex items-center gap-1.5">
                <MapPin size={12} className="text-brand-dark shrink-0" />
                {location.location_text}
              </p>
            )}

            {/* ── Facility info chips ── */}
            {(location.opening_time || location.total_seats != null || location.power_outlets != null) && (
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                {location.opening_time && (
                  <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                    <Clock size={13} className="text-brand-dark shrink-0" />
                    {location.opening_time}
                  </div>
                )}
                {location.total_seats != null && (
                  <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                    <Users size={13} className="text-brand-dark shrink-0" />
                    {location.total_seats} seats
                  </div>
                )}
                {location.power_outlets != null && (
                  <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                    <Zap size={13} className="text-brand-dark shrink-0" />
                    {location.power_outlets} outlets
                  </div>
                )}
              </div>
            )}

            {/* ── Description ── */}
            {location.description && (
              <p className="text-sm text-ink-muted mt-3 leading-relaxed">
                {location.description}
              </p>
            )}
              </div>

              {/* ── Active session timer ── */}
              {isMyActiveLocation && activeSession && (
                <div className="mt-4 flex items-center gap-2.5 px-3 py-2.5 bg-success-light border border-success/30 rounded-xl">
              <CheckCircle2 size={15} className="text-success shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-ink">You&apos;re checked in here</p>
                <p className="text-[11px] text-ink-muted">
                  {activeSession.activity === "study"
                    ? `Studying${activeSession.module ? ` · ${activeSession.module}` : ""}`
                    : "Eating"}
                  {" · "}
                  {activeSession.seats_needed} seat{activeSession.seats_needed !== 1 ? "s" : ""} reserved
                </p>
              </div>
                </div>
              )}

              {/* ── Action buttons ── */}
              <div className="mt-4">
                {isMyActiveLocation ? (
                  <button
                    onClick={onLeaveSpot}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-alert-light hover:bg-alert/20 text-alert border border-alert/40 font-semibold text-sm rounded-full transition-all duration-200 active:scale-[0.98]"
                  >
                    <LogOut size={15} />
                    Leave Spot
                  </button>
                ) : (
                  <button
                    onClick={onCheckIn}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-brand hover:bg-brand-dark text-ink border border-brand font-semibold text-sm rounded-full transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
                  >
                    <LogIn size={15} />
                    Scan QR to Enter
                  </button>
                )}
              </div>

              {/* ── Reviews ── */}
              <div className="mt-6">
                <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-widest mb-3">
                  Reviews
                </p>
                {reviews.length === 0 ? (
                  <p className="text-xs text-ink-faint py-3">No reviews yet. Be the first!</p>
                ) : (
                  reviews.map((review) => (
                    <div key={review.id} className="py-3 border-b border-border last:border-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-6 h-6 rounded-full bg-brand-light flex items-center justify-center text-[9px] font-bold text-ink shrink-0">
                          {review.username.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold text-ink">@{review.username}</span>
                        <span className="text-[10px] text-ink-faint ml-auto">
                          {timeAgo(review.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-ink-muted leading-relaxed">{review.comment}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export default function DashboardPage() {
  const [greeting, setGreeting]               = useState({ text: "", emoji: "" });
  const [alertVisible, setAlertVisible]       = useState(true);
  const [statusFilter, setStatusFilter]       = useState<LocationStatus | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<DashboardLocation | null>(null);
  const [activeSession, setActiveSession]     = useState<ActiveSession | null>(null);
  const [qrScanOpen, setQrScanOpen]           = useState(false);
  const [checkInOpen, setCheckInOpen]         = useState(false);
  const [feedbackOpen, setFeedbackOpen]       = useState(false);

  const [userId,  setUserId]  = useState<string | null>(null);
  const [profile, setProfile] = useState<DashboardProfile | null>(null);

  // `id` from active_sessions — held so we can mark the row inactive on check-out
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);

  // Post-QR-scan action choice
  const [actionChoiceOpen, setActionChoiceOpen] = useState(false);
  const [studyBuddyOpen,   setStudyBuddyOpen]   = useState(false);

  // Floating +pts animation
  const [pointsDelta, setPointsDelta] = useState<number | null>(null);

  // Error toast for optimistic rollbacks
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const showErrorToast = (msg: string) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(null), 4000);
  };

  const [userRank, setUserRank] = useState<number | null>(null);

  // Computed from active_sessions seat tallies — drives the Peak Hour Alert banner
  const [busiestLocation, setBusiestLocation] = useState<{ name: string; seats: number } | null>(null);

  // Locations
  const [locations, setLocations]   = useState<DashboardLocation[]>([]);
  const [locLoading, setLocLoading] = useState(true);
  const [locError, setLocError]     = useState<string | null>(null);

  // Daily mission
  const [mission, setMission]           = useState<Mission | null>(null);
  const [missionLoading, setMissionLoading] = useState(true);
  const [missionStarted, setMissionStarted] = useState(false);

  // Ticks every 60 s — drives real-time progress for time-based missions
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Leaderboard snippet (top 3)
  const [topEntries, setTopEntries] = useState<LeaderboardEntry[]>([]);

  // Reviews for selected location
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => { setGreeting(getGreeting()); }, []);

  // Fetches profile and restores any active session that survived a page refresh.
  useEffect(() => {
    const supabase = createClient();

    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      const { data } = await supabase
        .from("profiles")
        .select("full_name, username, points, level, streak_days")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data as DashboardProfile);

        // Rank = count of users with more points + 1
        const { count } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .gt("points", data.points ?? 0);
        setUserRank((count ?? 0) + 1);
      }

      // Restore any session the user had before a page refresh
      const { data: existing } = await supabase
        .from("active_sessions")
        .select("id, location_id, activity, module, duration_minutes, seats_taken, check_in_time")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (existing) {
        // Fetch the location name directly so the banner never shows "Loading…"
        const { data: locRow } = await supabase
          .from("locations")
          .select("name")
          .eq("id", existing.location_id)
          .single();

        setActiveSessionId(existing.id);
        setActiveSession({
          locationId:       existing.location_id,
          locationName:     locRow?.name ?? "Unknown",
          seats_needed:     existing.seats_taken ?? 1,
          activity:         existing.activity as "study" | "eating",
          module:           existing.module ?? "",
          duration_minutes: existing.duration_minutes,
          endsAt: new Date(
            new Date(existing.check_in_time).getTime() +
            existing.duration_minutes * 60_000
          ),
        });
      }
    }

    loadProfile();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetches all locations and computes which is currently busiest (for the alert banner).
  useEffect(() => {
    const supabase = createClient();

    async function loadLocations() {
      const { data, error } = await supabase
        .from("locations")
        .select(
          "id, name, category, current_status, coordinates_x, coordinates_y, images, location_text, opening_time, total_seats, power_outlets, description"
        )
        .order("name");

      if (error) {
        setLocError(error.message);
        setLocLoading(false);
        return;
      }

      const mapped = (data ?? []).map((loc) => ({
        ...loc,
        current_status: (loc.current_status as string).toLowerCase() as LocationStatus,
      }));

      setLocations(mapped);

      // Patch in the real location name for any session restored on mount
      setActiveSession((prev) =>
        prev && prev.locationName === "Loading…"
          ? { ...prev, locationName: mapped.find((l) => l.id === prev.locationId)?.name ?? "Unknown" }
          : prev
      );

      // Tally seats per location to find the busiest spot for the alert banner
      const { data: sessions } = await supabase
        .from("active_sessions")
        .select("location_id, seats_taken")
        .eq("is_active", true);

      if (sessions && sessions.length > 0) {
        const tally: Record<number, number> = {};
        sessions.forEach((s) => {
          tally[s.location_id] = (tally[s.location_id] ?? 0) + (s.seats_taken ?? 1);
        });
        const sorted     = Object.entries(tally).sort((a, b) => b[1] - a[1]);
        const busiestId  = Number(sorted[0][0]);
        const busiestLoc = mapped.find((l) => l.id === busiestId);
        if (busiestLoc) setBusiestLocation({ name: busiestLoc.name, seats: tally[busiestId] });
      }

      setLocLoading(false);
    }

    loadLocations();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Loads today's mission and top-3 leaderboard. Waits for userId from the profile effect.
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    async function loadMissionAndLeaderboard() {
      // Pick today's mission by rotating through all missions using day-of-year.
      // Everyone sees the same mission on the same day, and it resets at midnight.
      const { data: allMissions } = await supabase
        .from("missions")
        .select("id, title, description, reward_points, target_count, target_action, period")
        .order("id");

      if (allMissions && allMissions.length > 0) {
        const startOfYear   = new Date(new Date().getFullYear(), 0, 0);
        const dayOfYear     = Math.floor((Date.now() - startOfYear.getTime()) / 86_400_000);
        const todaysMission = allMissions[dayOfYear % allMissions.length];

        const { data: userMission } = await supabase
          .from("user_mission")
          .select("progress")
          .eq("user_id", userId)
          .eq("mission_id", todaysMission.id)
          .maybeSingle();

        setMission({
          id:            todaysMission.id,
          title:         todaysMission.title,
          description:   todaysMission.description ?? "",
          reward_points: todaysMission.reward_points ?? 10,
          target_count:  todaysMission.target_count ?? 1,
          progress:      userMission?.progress ?? 0,
          location_hint: todaysMission.period ?? "Daily",
          target_action: todaysMission.target_action ?? "",
        });
        if (sessionStorage.getItem(`mission-started-${todaysMission.id}`) === "true") {
          setMissionStarted(true);
        }
      }

      setMissionLoading(false);

      supabase
        .from("profiles")
        .select("full_name, username, points, level")
        .order("points", { ascending: false })
        .limit(3)
        .then(({ data }) => {
          if (!data) return;
          setTopEntries(
            data.map((p, i) => ({
              rank:     i + 1,
              name:     p.full_name ?? p.username ?? "Student",
              initials: getInitials(p.full_name ?? p.username ?? "ST"),
              points:   p.points ?? 0,
              level:    p.level ?? getLevelNumber(p.points ?? 0),
            }))
          );
        });
    }

    loadMissionAndLeaderboard();
  }, [userId]); // Re-run if userId changes (e.g. after login)

  // Fetch reviews for the currently selected location
  useEffect(() => {
    if (!selectedLocation) { setReviews([]); return; }
    const supabase = createClient();
    supabase
      .from("reviews")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("id, comment, created_at, profiles(username)" as any)
      .eq("location_id", selectedLocation.id)
      .order("created_at", { ascending: false })
      .limit(5)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: any[] | null }) => {
        if (!data) return;
        setReviews(
          data.map((r) => ({
            id:         r.id,
            username:   (r.profiles as { username: string } | null)?.username ?? "anonymous",
            comment:    r.comment,
            created_at: r.created_at,
          }))
        );
      });
  }, [selectedLocation]);

  // Realtime subscription — keeps status dots and the busiest-location banner in sync
  // without requiring a manual refresh.
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "locations" },
        (payload) => {
          setLocations((prev) =>
            prev.map((loc) =>
              loc.id === payload.new.id
                ? { ...loc, current_status: payload.new.current_status as LocationStatus }
                : loc
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "active_sessions" },
        () => {
          supabase
            .from("active_sessions")
            .select("location_id, seats_taken")
            .eq("is_active", true)
            .then(({ data: sessions }) => {
              if (!sessions || sessions.length === 0) {
                setBusiestLocation(null);
                return;
              }
              const tally: Record<number, number> = {};
              sessions.forEach((s) => {
                tally[s.location_id] = (tally[s.location_id] ?? 0) + (s.seats_taken ?? 1);
              });
              const sorted    = Object.entries(tally).sort((a, b) => b[1] - a[1]);
              const busiestId = Number(sorted[0][0]);
              // Read latest locations state functionally to avoid stale closure
              setLocations((prev) => {
                const loc = prev.find((l) => l.id === busiestId);
                if (loc) setBusiestLocation({ name: loc.name, seats: tally[busiestId] });
                return prev;
              });
            });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredLocations = statusFilter
    ? locations.filter((l) => l.current_status === statusFilter)
    : locations;

  const progressPct = mission
    ? Math.round((mission.progress / mission.target_count) * 100)
    : 0;

  // Minutes a session must last to count toward each time-based mission
  const MISSION_TIME_THRESHOLDS: Record<string, number> = {
    study:        120, // Focused Scholar — 2-hour study session
    stay_3_hours: 180, // Study Marathon  — 3-hour session
  };

  const realtimeProgressPct = (() => {
    if (!mission) return 0;
    const threshold = MISSION_TIME_THRESHOLDS[mission.target_action];
    if (threshold && activeSession?.activity === "study") {
      const sessionStart = new Date(
        activeSession.endsAt.getTime() - activeSession.duration_minutes * 60_000
      );
      const elapsedMin = Math.max(0, (now.getTime() - sessionStart.getTime()) / 60_000);
      const sessionFraction = Math.min(1, elapsedMin / threshold);
      return Math.min(100, Math.round(
        ((mission.progress + sessionFraction) / mission.target_count) * 100
      ));
    }
    return progressPct; // non-time missions use integer-based count
  })();

  const missionDone       = progressPct >= 100;
  const missionInProgress = !missionDone && (
    (mission?.progress ?? 0) > 0 ||
    missionStarted ||
    realtimeProgressPct > progressPct   // active session contributing real-time progress
  );

  const scrollToMap = () => {
    const el = document.querySelector<HTMLElement>("#library-map");
    const main = document.querySelector<HTMLElement>("main");
    if (!el || !main) return;
    const top = main.scrollTop + el.getBoundingClientRect().top - main.getBoundingClientRect().top - 16;
    main.scrollTo({ top, behavior: "smooth" });
  };

  // Creates an active_sessions row, awards check-in points, and recalculates location status.
  const handleCheckInSubmit = async (data: CheckInData) => {
    if (!selectedLocation || !userId) return;

    const supabase = createClient();

    // Optimistic: show the active-session banner and close the modal immediately.
    // The session ID is filled in once the DB responds (two-phase).
    setActiveSession({
      locationId:   selectedLocation.id,
      locationName: selectedLocation.name,
      ...data,
      endsAt: new Date(Date.now() + data.duration_minutes * 60_000),
    });
    setCheckInOpen(false);

    // 'seats_needed' in the modal maps to 'seats_taken' in the DB
    const { data: session, error } = await supabase
      .from("active_sessions")
      .insert({
        user_id:          userId,
        location_id:      selectedLocation.id,
        activity:         data.activity,
        module:           data.module || null,
        duration_minutes: data.duration_minutes,
        seats_taken:      data.seats_needed,
        is_active:        true,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[check-in] Failed to create session:", error.message);
      setActiveSession(null); // rollback
      showErrorToast("Check-in failed. Please try again.");
      return;
    }

    setActiveSessionId(session.id);

    // Look up points from point_rules so admins can tune the value without a deploy
    const { data: rule } = await supabase
      .from("point_rules")
      .select("points_awarded")
      .eq("action_name", "check_in")
      .eq("is_active", true)
      .single();

    if (rule?.points_awarded) {
      await supabase.rpc("increment_points", { user_id: userId, amount: rule.points_awarded });
      setProfile((prev) =>
        prev ? { ...prev, points: prev.points + rule.points_awarded } : prev
      );
      setPointsDelta(rule.points_awarded);
      setTimeout(() => setPointsDelta(null), 2500);
      try { sessionStorage.setItem("simplify_points_dirty", "1"); } catch { /* ignore */ }
    }
    trackMissionProgress(supabase, userId, POINT_ACTIONS.CHECK_IN);
    // Early Bird: also fire if checking in before 9 AM local time
    if (new Date().getHours() < 9) {
      trackMissionProgress(supabase, userId, POINT_ACTIONS.CHECK_IN_EARLY);
    }

    // Recalculate the location's live status based on total seats now occupied
    const { data: activeSessions } = await supabase
      .from("active_sessions")
      .select("seats_taken")
      .eq("location_id", selectedLocation.id)
      .eq("is_active", true);

    const totalOccupied = (activeSessions ?? []).reduce(
      (sum, s) => sum + (s.seats_taken ?? 1), 0
    );
    const totalSeats = selectedLocation.total_seats ?? 0;
    const fillPct    = totalSeats > 0 ? (totalOccupied / totalSeats) * 100 : 0;
    // 0% = empty, up to 60% = still empty, 61–90% = busy, 91%+ = full
    const newStatus: LocationStatus =
      fillPct === 0 ? "empty" : fillPct <= 60 ? "empty" : fillPct <= 90 ? "busy" : "full";

    await supabase
      .from("locations")
      .update({ current_status: newStatus })
      .eq("id", selectedLocation.id);
  };

  // Creates a study group at the selected location, reserves seats, and awards points.
  const handleStudyBuddySubmit = async (data: StudyBuddyData) => {
    if (!selectedLocation || !userId) return;

    const supabase = createClient();

    // Optimistic: show the active-session banner and close the modal immediately.
    setActiveSession({
      locationId:       selectedLocation.id,
      locationName:     selectedLocation.name,
      seats_needed:     data.max_members,
      activity:         "study",
      module:           data.topic,
      duration_minutes: 120,
      endsAt:           new Date(Date.now() + 120 * 60_000),
    });
    setStudyBuddyOpen(false);

    // 1. Create the study group
    const { data: group, error: groupError } = await supabase
      .from("study_groups")
      .insert({
        host_id:         userId,
        location_id:     selectedLocation.id,
        subject:         data.topic || "Study Session",
        max_members:     data.max_members,
        current_members: 1,
        is_active:       true,
      })
      .select("id")
      .single();

    if (groupError || !group) {
      console.error("[study-buddy] Failed to create group:", groupError?.message);
      setActiveSession(null); // rollback
      showErrorToast("Failed to create study group. Please try again.");
      return;
    }

    // 2. Add the creator as the first member
    await supabase.from("study_group_members").insert({
      group_id: group.id,
      user_id:  userId,
    });

    // 3. Create an active_sessions row so the seat count is reflected on the map
    const { data: session } = await supabase
      .from("active_sessions")
      .insert({
        user_id:          userId,
        location_id:      selectedLocation.id,
        activity:         "study_group",
        module:           data.topic || null,
        duration_minutes: 120,
        seats_taken:      1,
        is_active:        true,
      })
      .select("id")
      .single();

    if (session) setActiveSessionId(session.id);

    // 4. Award points for creating a study group
    const { data: rule } = await supabase
      .from("point_rules")
      .select("points_awarded")
      .eq("action_name", "study_group_create")
      .eq("is_active", true)
      .maybeSingle();

    if (rule?.points_awarded) {
      await supabase.rpc("increment_points", { user_id: userId, amount: rule.points_awarded });
      setProfile((prev) =>
        prev ? { ...prev, points: prev.points + rule.points_awarded } : prev
      );
      setPointsDelta(rule.points_awarded);
      setTimeout(() => setPointsDelta(null), 2500);
      try { sessionStorage.setItem("simplify_points_dirty", "1"); } catch { /* ignore */ }
    }
    trackMissionProgress(supabase, userId, POINT_ACTIONS.CREATE_STUDY_GROUP);

    // 5. Recalculate location status
    const { data: activeSessions } = await supabase
      .from("active_sessions")
      .select("seats_taken")
      .eq("location_id", selectedLocation.id)
      .eq("is_active", true);

    const totalOccupied = (activeSessions ?? []).reduce((sum, s) => sum + (s.seats_taken ?? 1), 0);
    const totalSeats    = selectedLocation.total_seats ?? 0;
    const fillPct       = totalSeats > 0 ? (totalOccupied / totalSeats) * 100 : 0;
    const newStatus: LocationStatus =
      fillPct === 0 ? "empty" : fillPct <= 60 ? "empty" : fillPct <= 90 ? "busy" : "full";

    await supabase
      .from("locations")
      .update({ current_status: newStatus })
      .eq("id", selectedLocation.id);
  };

  // Ends the session, awards feedback points, optionally saves a review, and
  // recalculates the location status based on remaining active sessions.
  const handleFeedbackSubmit = async (data: FeedbackData) => {
    if (!selectedLocation || !userId || !activeSessionId) return;

    const supabase = createClient();

    // Snapshot for rollback
    const snapshotSession   = activeSession;
    const snapshotSessionId = activeSessionId;
    const snapshotLocation  = selectedLocation;

    // Optimistic: dismiss the session banner and close the drawer immediately.
    setActiveSession(null);
    setActiveSessionId(null);
    setFeedbackOpen(false);
    setSelectedLocation(null);

    // Soft-delete the session row (keeps the history intact for analytics)
    const { error: endError } = await supabase
      .from("active_sessions")
      .update({ is_active: false })
      .eq("id", snapshotSessionId);

    if (endError) {
      // Rollback so the user can try again
      setActiveSession(snapshotSession);
      setActiveSessionId(snapshotSessionId);
      setFeedbackOpen(true);
      setSelectedLocation(snapshotLocation);
      showErrorToast("Failed to end session. Please try again.");
      return;
    }

    // Award feedback points. Uses point_rules so admins can tune without a deploy.
    const { data: feedbackRule } = await supabase
      .from("point_rules")
      .select("points_awarded")
      .eq("action_name", "leave_review")
      .eq("is_active", true)
      .maybeSingle();

    const feedbackPts = feedbackRule?.points_awarded ?? 15;
    await supabase.rpc("increment_points", { user_id: userId, amount: feedbackPts });
    setProfile((prev) =>
      prev ? { ...prev, points: prev.points + feedbackPts } : prev
    );
    trackMissionProgress(supabase, userId, POINT_ACTIONS.LEAVE_REVIEW);
    const durationMins = snapshotSession?.duration_minutes ?? 0;
    // Study Marathon: session was planned for 3+ hours (180 min)
    if (durationMins >= 180) {
      trackMissionProgress(supabase, userId, POINT_ACTIONS.STAY_3_HOURS);
    }
    // Focused Scholar: 2+ hour study session (not eating)
    if (durationMins >= 120 && snapshotSession?.activity === "study") {
      trackMissionProgress(supabase, userId, POINT_ACTIONS.STUDY);
    }

    // crowd_status → star rating: empty = 5★, busy = 3★, full = 1★
    if (data.comment.trim()) {
      const rating =
        data.crowd_status === "empty" ? 5 :
        data.crowd_status === "busy"  ? 3 : 1;

      await supabase.from("reviews").insert({
        location_id: snapshotLocation.id,
        user_id:     userId,
        comment:     data.comment,
        rating,
      });
    }

    // Recalculate location status now that this session has ended
    const { data: remaining } = await supabase
      .from("active_sessions")
      .select("seats_taken")
      .eq("location_id", snapshotLocation.id)
      .eq("is_active", true);

    const totalOccupied = (remaining ?? []).reduce(
      (sum, s) => sum + (s.seats_taken ?? 1), 0
    );
    const totalSeats = snapshotLocation.total_seats ?? 0;
    const fillPct    = totalSeats > 0 ? (totalOccupied / totalSeats) * 100 : 0;
    const newStatus: LocationStatus =
      fillPct === 0 ? "empty" : fillPct <= 60 ? "empty" : fillPct <= 90 ? "busy" : "full";

    await supabase
      .from("locations")
      .update({ current_status: newStatus })
      .eq("id", snapshotLocation.id);

    setLocations((prev) =>
      prev.map((l) =>
        l.id === snapshotLocation.id ? { ...l, current_status: newStatus } : l
      )
    );
  };

  return (
    <>
      {/* ── Floating +pts animation ── */}
      <AnimatePresence>
        {pointsDelta !== null && (
          <motion.div
            key="pts-delta"
            initial={{ opacity: 1, y: 0, scale: 0.9 }}
            animate={{ opacity: 0, y: -60, scale: 1.15 }}
            transition={{ duration: 2.2, ease: "easeOut" }}
            className="fixed top-24 right-4 z-80 flex items-center gap-1.5 bg-gold text-ink font-bold text-base px-4 py-2 rounded-full shadow-lg pointer-events-none"
          >
            <Coins size={16} />
            +{pointsDelta} pts
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error toast (optimistic rollback feedback) ── */}
      <AnimatePresence>
        {errorToast && (
          <motion.div
            key="error-toast"
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: 8,   scale: 0.97 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-start gap-2.5 bg-ink text-surface text-sm font-medium px-4 py-3 rounded-2xl shadow-xl max-w-xs w-[calc(100vw-2rem)]"
          >
            <AlertCircle size={16} className="text-alert shrink-0 mt-0.5" />
            {errorToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Location drawer ── */}
      <AnimatePresence>
        {selectedLocation && (
          <LocationDrawer
            location={selectedLocation}
            activeSession={activeSession}
            reviews={reviews}
            onCheckIn={() => setQrScanOpen(true)}
            onLeaveSpot={() => setFeedbackOpen(true)}
            onClose={() => setSelectedLocation(null)}
          />
        )}
      </AnimatePresence>

      {/* ── QR scanner (z-70, above everything) ── */}
      {selectedLocation && (
        <QRScannerModal
          open={qrScanOpen}
          locationName={selectedLocation.name}
          requiredLocationId={selectedLocation.id}
          onOpenChange={(open) => { if (!open) setQrScanOpen(false); }}
          onSuccess={() => { setQrScanOpen(false); setActionChoiceOpen(true); }}
        />
      )}

      {/* ── Action choice (after QR verified) ── */}
      {selectedLocation && (
        <ActionChoiceModal
          open={actionChoiceOpen}
          locationName={selectedLocation.name}
          onClose={() => setActionChoiceOpen(false)}
          onCheckIn={() => { setActionChoiceOpen(false); setCheckInOpen(true); }}
          onStudyBuddy={() => { setActionChoiceOpen(false); setStudyBuddyOpen(true); }}
        />
      )}

      {/* ── Study buddy modal ── */}
      {selectedLocation && (
        <StudyBuddyModal
          open={studyBuddyOpen}
          locationName={selectedLocation.name}
          onOpenChange={(open) => { if (!open) setStudyBuddyOpen(false); }}
          onSubmit={handleStudyBuddySubmit}
        />
      )}

      {/* ── Check-in modal (z-60, above drawer) ── */}
      {selectedLocation && (
        <CheckInModal
          open={checkInOpen}
          locationName={selectedLocation.name}
          onOpenChange={(open) => { if (!open) setCheckInOpen(false); }}
          onSubmit={handleCheckInSubmit}
        />
      )}

      {/* ── Feedback / check-out modal ── */}
      {selectedLocation && (
        <FeedbackModal
          open={feedbackOpen}
          locationName={selectedLocation.name}
          onOpenChange={(open) => { if (!open) setFeedbackOpen(false); }}
          onSubmit={handleFeedbackSubmit}
        />
      )}

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-4 md:space-y-5"
      >

        {/* ── 1. Greeting Hero ── */}
        <motion.div variants={cardVariants}>
          <div className="relative bg-surface rounded-2xl p-6 md:p-8 shadow-sm border border-border overflow-hidden">
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-brand opacity-20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 left-24 w-36 h-36 rounded-full bg-gold opacity-10 blur-3xl pointer-events-none" />

            <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <p className="text-sm text-ink-muted font-medium flex items-center gap-1.5">
                  {greeting.emoji && <span>{greeting.emoji}</span>}
                  {greeting.text}
                </p>

                <h2 className="text-2xl md:text-3xl font-bold text-ink mt-1 leading-tight">
                  {profile === null ? (
                    <span className="inline-block h-8 w-48 bg-canvas rounded-lg animate-pulse" />
                  ) : (
                    <>
                      Ready to tackle your work,{" "}
                      <span className="text-brand-dark dark:text-brand">
                        {profile.full_name ?? profile.username ?? "Student"}
                      </span>?
                    </>
                  )}
                </h2>

                <p className="text-sm text-ink-muted mt-2 flex items-center gap-1.5">
                  <Flame size={14} className="text-alert shrink-0" />
                  {profile === null ? (
                    <span className="inline-block h-4 w-40 bg-canvas rounded animate-pulse" />
                  ) : (
                    <>
                      You&apos;re on a{" "}
                      <span className="font-semibold text-ink">{profile.streak_days}-day</span>{" "}
                      study streak. Keep it up!
                    </>
                  )}
                </p>
              </div>

              <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 shrink-0">
                {/* ── Points badge ── */}
                <div className="flex items-center gap-1.5 bg-gold-light border border-gold/30 px-3 py-1.5 rounded-full">
                  <Coins size={13} className="text-gold" />
                  <span className="text-sm font-bold text-gold">
                    {profile === null ? (
                      <span className="inline-block h-4 w-16 bg-gold/20 rounded animate-pulse" />
                    ) : (
                      `${(profile.points ?? 0).toLocaleString()} pts`
                    )}
                  </span>
                </div>
                {/* ── Level badge ── */}
                <div className="flex items-center gap-1.5 bg-brand-faint border border-brand/40 px-3 py-1.5 rounded-full">
                  <Star size={13} className="text-brand-dark" />
                  <span className="text-sm font-semibold text-ink">
                    {profile === null ? (
                      <span className="inline-block h-4 w-12 bg-brand/20 rounded animate-pulse" />
                    ) : (
                      `Level ${profile.level ?? 1}`
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Layout update: keep the live map near the welcome message for quicker access. */}
        {/* Check-in notifications are separate cards above the map (not inside the map wrapper). */}
        {activeSession && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            variants={cardVariants}
          >
            <div className="flex items-center gap-3 px-4 py-3 bg-success-light border border-success/30 rounded-2xl">
              <CheckCircle2 size={16} className="text-success shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">
                  Checked in at{" "}
                  <span className="text-success">{activeSession.locationName}</span>
                </p>
                <p className="text-xs text-ink-muted">
                  {activeSession.activity === "study"
                    ? `Studying${activeSession.module ? ` · ${activeSession.module}` : ""}`
                    : "Eating"}
                  {" · "}
                  {activeSession.seats_needed} seat{activeSession.seats_needed !== 1 ? "s" : ""} reserved
                </p>
              </div>
              <button
                onClick={() => {
                  const loc = locations.find((l) => l.id === activeSession.locationId);
                  if (loc) { setSelectedLocation(loc); setFeedbackOpen(true); }
                }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-alert-light text-alert border border-alert/30 hover:bg-alert/20 transition-colors"
              >
                <LogOut size={12} /> Leave
              </button>
            </div>
          </motion.div>
        )}

        {alertVisible && busiestLocation && (
          <motion.div variants={cardVariants}>
            <div className="flex items-start gap-3 bg-alert-light border border-alert/40 rounded-2xl px-4 py-3.5">
              <AlertTriangle size={18} className="text-alert shrink-0 mt-0.5" strokeWidth={2.2} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink leading-snug">
                  {busiestLocation.name} is busy right now
                </p>
                <p className="text-xs text-ink-muted mt-0.5">
                  {busiestLocation.seats} seat{busiestLocation.seats !== 1 ? "s" : ""} currently occupied · Expect crowded study zones.{" "}
                  <button
                    onClick={() => { setAlertVisible(false); scrollToMap(); }}
                    className="font-medium text-ink underline underline-offset-2 hover:text-brand-dark transition-colors"
                  >
                    Check live status →
                  </button>
                </p>
              </div>
              <button
                onClick={() => setAlertVisible(false)}
                aria-label="Dismiss alert"
                className="shrink-0 p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-alert/20 transition-colors duration-150"
              >
                <X size={15} />
              </button>
            </div>
          </motion.div>
        )}

        {/* ── 2. Library Map ── */}
        <motion.div variants={cardVariants} id="library-map">
          <div className="bg-surface rounded-2xl border border-border shadow-sm p-5 md:p-6">
            {/* Primary heading above map status labels to guide first action. */}
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gold-light border border-gold/30">
                <MapPin size={14} className="text-gold" />
              </span>
              <h3 className="text-lg md:text-xl font-bold text-ink">Pick a spot</h3>
              <span className="h-0.5 flex-1 rounded-full bg-linear-to-r from-brand/70 to-transparent" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                {/* Match primary/secondary text colors with other section headers. */}
                <p className="text-xs md:text-sm font-bold text-ink uppercase tracking-wide leading-none">
                  Tay Eng Soon Library
                </p>
                <p className="text-base text-ink-muted mt-1.5">Live Zone Status</p>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {FILTER_OPTIONS.map(({ value, label, active, inactive }) => (
                  <button
                    key={String(value)}
                    onClick={() => setStatusFilter(value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all duration-200 ${
                      statusFilter === value ? active : inactive
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {locLoading ? (
              <div className="h-72 md:h-96 rounded-xl bg-canvas border border-border flex items-center justify-center">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-ink-muted">Loading library zones…</p>
                </div>
              </div>
            ) : locError ? (
              <div className="h-72 md:h-96 rounded-xl bg-alert-light border border-alert/20 flex items-center justify-center px-4">
                <div className="text-center">
                  <AlertTriangle size={24} className="text-alert mx-auto mb-2" />
                  <p className="text-sm text-alert font-medium">Failed to load locations</p>
                  <p className="text-xs text-ink-muted mt-1">{locError}</p>
                </div>
              </div>
            ) : (
              <div className="h-72 md:h-96 rounded-xl overflow-hidden border border-border">
                <InteractiveMap
                  locations={filteredLocations}
                  onSelectLocation={(loc) => {
                    const dloc = locations.find((l) => l.id === loc.id);
                    if (dloc) setSelectedLocation(dloc);
                  }}
                />
              </div>
            )}

            {/* Quick-pick cards stay below the map for fast filtering and selection. */}
            {locLoading ? (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-16 bg-canvas rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {filteredLocations.map((loc) => {
                  const s = STATUS_CONFIG[loc.current_status];
                  const isCheckedIn = activeSession?.locationId === loc.id;
                  return (
                    <button
                      key={loc.id}
                      onClick={() => setSelectedLocation(loc)}
                      className="group p-3 bg-canvas border border-border rounded-xl hover:border-brand hover:bg-brand-faint transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm text-left"
                    >
                      <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold mb-1.5 ${s.bg} ${s.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                        {isCheckedIn ? "You're here" : s.label}
                      </div>
                      <p className="text-xs font-semibold text-ink leading-tight truncate">{loc.name}</p>
                      <p className="text-[10px] text-ink-faint mt-0.5 truncate">{loc.category}</p>
                    </button>
                  );
                })}
                {filteredLocations.length === 0 && (
                  <div className="col-span-full text-center py-6 text-sm text-ink-muted">
                    No zones match this filter.
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* ── 3 + 4. Daily Mission + Leaderboard ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-5">

          {/* ── 3. Daily Mission ── */}
          <motion.div variants={cardVariants} className="lg:col-span-3">
            <div className="h-full bg-surface rounded-2xl border border-border shadow-sm p-5 md:p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gold-light flex items-center justify-center">
                    <Target size={16} className="text-gold" strokeWidth={2.2} />
                  </div>
                  <div>
                    {/* Promote mission heading text so the card title is legible at a glance. */}
                    <p className="text-xs md:text-sm font-bold text-ink uppercase tracking-wide leading-none">
                      Daily Mission
                    </p>
                    <p className="text-sm text-ink-muted leading-none mt-0.5">Resets at midnight</p>
                  </div>
                  <span className="hidden sm:block h-0.5 flex-1 rounded-full bg-linear-to-r from-brand/70 to-transparent" />
                </div>
                {mission && (
                  <div className="flex items-center gap-1 bg-gold-light border border-gold/30 px-2.5 py-1 rounded-full">
                    <Coins size={12} className="text-gold" />
                    <span className="text-xs font-bold text-gold">
                      +{mission.reward_points} pts
                    </span>
                  </div>
                )}
              </div>

              {missionLoading ? (
                <div className="flex-1 space-y-3">
                  <div className="h-5 w-2/3 bg-canvas rounded animate-pulse" />
                  <div className="h-12 bg-canvas rounded animate-pulse" />
                  <div className="h-4 w-1/2 bg-canvas rounded animate-pulse" />
                </div>
              ) : mission ? (
                <>
                  <h3 className="text-lg font-bold text-ink leading-tight">{mission.title}</h3>
                  <p className="text-sm text-ink-muted mt-1.5 leading-relaxed flex-1">
                    {mission.description}
                  </p>

                  <div className="flex items-center gap-1.5 mt-3 text-xs text-ink-muted">
                    <MapPin size={12} className="shrink-0 text-brand-dark" />
                    <span>{mission.location_hint}</span>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-ink-muted">Progress</span>
                      <span className="text-xs font-semibold text-ink">
                        {mission.progress} / {mission.target_count}
                      </span>
                    </div>
                    <div className="h-2 bg-brand-light rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-dark rounded-full transition-all duration-700"
                        style={{ width: `${realtimeProgressPct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-ink-faint mt-1 text-right">{realtimeProgressPct}%</p>
                  </div>

                  {missionDone ? (
                    <button
                      disabled
                      className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-gold-light border border-gold/30 text-gold font-semibold text-sm rounded-full cursor-not-allowed"
                    >
                      <CheckCircle2 size={15} />
                      Mission Complete!
                    </button>
                  ) : missionInProgress ? (
                    <button
                      onClick={scrollToMap}
                      className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-brand-faint border border-brand/40 text-brand-dark font-semibold text-sm rounded-full transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
                    >
                      <span className="w-2 h-2 rounded-full bg-brand-dark animate-pulse shrink-0" />
                      {realtimeProgressPct > 0
                        ? `In Progress · ${realtimeProgressPct}%`
                        : "In Progress"}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setMissionStarted(true);
                        sessionStorage.setItem(`mission-started-${mission.id}`, "true");
                        scrollToMap();
                      }}
                      className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-brand hover:bg-brand-dark text-ink font-semibold text-sm rounded-full transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
                    >
                      <CheckCircle2 size={15} />
                      Start Mission
                    </button>
                  )}
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
                  <Target size={28} className="text-ink-faint mb-2 opacity-30" />
                  <p className="text-sm text-ink-muted">No active mission today.</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* ── 4. Leaderboard Snippet ── */}
          <motion.div variants={cardVariants} className="lg:col-span-2">
            <div className="h-full bg-surface rounded-2xl border border-border shadow-sm p-5 md:p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gold-light flex items-center justify-center">
                    <Trophy size={15} className="text-gold" strokeWidth={2.2} />
                  </div>
                  <div>
                    {/* Match leaderboard title sizing with mission for consistent hierarchy. */}
                    <p className="text-xs md:text-sm font-bold text-ink uppercase tracking-wide leading-none">
                      This Week
                    </p>
                    <p className="text-sm text-ink-muted leading-none mt-0.5">Top Contributors</p>
                  </div>
                  <span className="hidden sm:block h-0.5 flex-1 rounded-full bg-linear-to-r from-brand/70 to-transparent" />
                </div>
                <Link
                  href="/leaderboard"
                  className="text-xs font-medium text-brand-dark hover:text-ink flex items-center gap-0.5 transition-colors duration-150"
                >
                  View all <ChevronRight size={13} />
                </Link>
              </div>

              <div className="flex flex-col gap-2 flex-1">
                {topEntries.length === 0 ? (
                  <>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 rounded-xl bg-canvas animate-pulse" />
                    ))}
                  </>
                ) : (
                  topEntries.map((entry) => {
                    const style = RANK_STYLE[entry.rank];
                    return (
                      <div
                        key={entry.rank}
                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-brand-faint transition-colors duration-150"
                      >
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ring-2 ${style.ring} bg-brand-light text-ink`}
                        >
                          {entry.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-ink truncate leading-tight">
                            {entry.name}
                          </p>
                          <p className="text-[10px] text-ink-muted leading-tight mt-0.5">
                            Level {entry.level}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${style.badge}`}
                        >
                          {style.label} {entry.points.toLocaleString()}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-border">
                <div className="flex items-center justify-between text-xs text-ink-muted">
                  <span>Your rank this week</span>
                  <span className="font-semibold text-ink">
                    {userRank !== null ? `#${userRank}` : "#—"}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 bg-brand-light rounded-full overflow-hidden">
                  <div className="h-full bg-brand rounded-full" style={{ width: "34%" }} />
                </div>
              </div>
            </div>
          </motion.div>
        </div>

      </motion.div>
    </>
  );
}
