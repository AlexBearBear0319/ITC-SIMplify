"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import InteractiveMap from "@/components/features/InteractiveMap";
import CheckInModal, { type CheckInData } from "@/components/features/CheckInModal";
import FeedbackModal, { type FeedbackData } from "@/components/features/FeedbackModal";
import QRScannerModal from "@/components/features/QRScannerModal";
import { createClient } from "@/utils/supabase/client";
import {
  MapPin,
  Flame,
  AlertTriangle,
  CheckCircle2,
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

function getLevelNumber(pts: number): number {
  if (pts >= 5000) return 5;
  if (pts >= 3000) return 4;
  if (pts >= 1500) return 3;
  if (pts >= 500)  return 2;
  return 1;
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

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 pb-8">

          {/* ── Image carousel ── */}
          {hasImages ? (
            <div
              className="flex gap-2.5 overflow-x-auto px-4 pt-3 pb-1 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarWidth: "none" }}
            >
              {location.images!.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt={`${location.name} photo ${i + 1}`}
                  className="w-64 h-36 object-cover rounded-xl shrink-0 snap-start"
                />
              ))}
            </div>
          ) : (
            <div className="mx-4 mt-3 h-36 rounded-xl bg-linear-to-br from-brand-faint to-brand/20 flex items-center justify-center">
              <MapPin size={36} className="text-brand-dark opacity-30" />
            </div>
          )}

          {/* ── Header: status + name + close ── */}
          <div className="px-5 pt-4">
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
            <div className="mx-5 mt-4 flex items-center gap-2.5 px-3 py-2.5 bg-success-light border border-success/30 rounded-xl">
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
          <div className="px-5 mt-4 flex gap-2">
            {isMyActiveLocation ? (
              <button
                onClick={onLeaveSpot}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-alert-light hover:bg-alert/20 text-alert border border-alert/40 font-semibold text-sm rounded-full transition-all duration-200 active:scale-[0.98]"
              >
                <LogOut size={15} />
                Leave Spot
              </button>
            ) : (
              <button
                onClick={onCheckIn}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-brand hover:bg-brand-dark text-ink border border-brand font-semibold text-sm rounded-full transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
              >
                <LogIn size={15} />
                Check In · +10 pts
              </button>
            )}
            <Link
              href={`/finder?locationId=${location.id}`}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-canvas border border-border text-ink-muted hover:text-ink hover:border-brand hover:bg-brand-faint font-semibold text-sm rounded-full transition-all duration-200 active:scale-[0.98]"
            >
              <Users size={15} />
              Study Buddy
            </Link>
          </div>

          {/* ── Reviews ── */}
          <div className="px-5 mt-6">
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

  // Locations
  const [locations, setLocations]   = useState<DashboardLocation[]>([]);
  const [locLoading, setLocLoading] = useState(true);
  const [locError, setLocError]     = useState<string | null>(null);

  // Daily mission
  const [mission, setMission]           = useState<Mission | null>(null);
  const [missionLoading, setMissionLoading] = useState(true);

  // Leaderboard snippet (top 3)
  const [topEntries, setTopEntries] = useState<LeaderboardEntry[]>([]);

  // Reviews for selected location
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => { setGreeting(getGreeting()); }, []);

  // Fetch locations
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("locations")
      .select(
        "id, name, category, current_status, coordinates_x, coordinates_y, images, location_text, opening_time, total_seats, power_outlets, description"
      )
      .order("name")
      .then(({ data, error }) => {
        if (error) {
          setLocError(error.message);
        } else {
          setLocations(
            (data ?? []).map((loc) => ({
              ...loc,
              current_status: (loc.current_status as string).toLowerCase() as LocationStatus,
            }))
          );
        }
        setLocLoading(false);
      });
  }, []);

  // Fetch daily mission + top-3 leaderboard
  useEffect(() => {
    const supabase = createClient();

    supabase
      .from("missions")
      .select("id, title, description, reward_points, progress, target_count, location_hint")
      .eq("is_active", true)
      .single()
      .then(({ data }) => {
        if (data) setMission(data as Mission);
        setMissionLoading(false);
      });

    supabase
      .from("profiles")
      .select("full_name, points_balance")
      .order("points_balance", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (!data) return;
        setTopEntries(
          data.map((p, i) => ({
            rank:    i + 1,
            name:    p.full_name,
            initials: getInitials(p.full_name),
            points:  p.points_balance,
            level:   getLevelNumber(p.points_balance),
          }))
        );
      });
  }, []);

  // Fetch reviews whenever selected location changes
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

  const filteredLocations = statusFilter
    ? locations.filter((l) => l.current_status === statusFilter)
    : locations;

  const progressPct = mission
    ? Math.round((mission.progress / mission.target_count) * 100)
    : 0;

  const scrollToMap = () =>
    document.getElementById("library-map")?.scrollIntoView({ behavior: "smooth" });

  // ── Check-in handler ──
  const handleCheckInSubmit = async (data: CheckInData) => {
    if (!selectedLocation) return;
    // TODO: supabase.from("active_sessions").insert({ ... })
    await new Promise((r) => setTimeout(r, 600));
    setActiveSession({
      locationId: selectedLocation.id,
      locationName: selectedLocation.name,
      ...data,
      endsAt: new Date(Date.now() + data.duration_minutes * 60_000),
    });
    setCheckInOpen(false);
  };

  // ── Feedback / check-out handler ──
  const handleFeedbackSubmit = async (data: FeedbackData) => {
    if (!selectedLocation) return;
    // TODO: update active_sessions, locations, insert review
    await new Promise((r) => setTimeout(r, 600));

    // Optimistic update
    setLocations((prev) =>
      prev.map((l) =>
        l.id === selectedLocation.id
          ? { ...l, current_status: data.crowd_status as LocationStatus }
          : l
      )
    );
    setActiveSession(null);
    setFeedbackOpen(false);
    setSelectedLocation(null);
  };

  return (
    <>
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
          onOpenChange={(open) => { if (!open) setQrScanOpen(false); }}
          onSuccess={() => setCheckInOpen(true)}
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
                  Ready to tackle your work,{" "}
                  <span className="text-brand-dark">Alex</span>?
                </h2>
                <p className="text-sm text-ink-muted mt-2 flex items-center gap-1.5">
                  <Flame size={14} className="text-alert shrink-0" />
                  You&apos;re on a{" "}
                  <span className="font-semibold text-ink">5-day</span> study streak. Keep it up!
                </p>
              </div>

              <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 shrink-0">
                <div className="flex items-center gap-1.5 bg-gold-light border border-gold/30 px-3 py-1.5 rounded-full">
                  <Coins size={13} className="text-gold" />
                  <span className="text-sm font-bold text-gold">1,240 pts</span>
                </div>
                <div className="flex items-center gap-1.5 bg-brand-faint border border-brand/40 px-3 py-1.5 rounded-full">
                  <Star size={13} className="text-brand-dark" />
                  <span className="text-sm font-semibold text-ink">Level 4</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Active session banner ── */}
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

        {/* ── 2. Peak Hour Alert ── */}
        {alertVisible && (
          <motion.div variants={cardVariants}>
            <div className="flex items-start gap-3 bg-alert-light border border-alert/40 rounded-2xl px-4 py-3.5">
              <AlertTriangle size={18} className="text-alert shrink-0 mt-0.5" strokeWidth={2.2} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink leading-snug">
                  Library is busy right now
                </p>
                <p className="text-xs text-ink-muted mt-0.5">
                  Peak hours detected · 10 AM – 1 PM · Expect crowded study zones.{" "}
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

        {/* ── 3 + 4. Daily Mission + Leaderboard ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-5">

          {/* ── 3. Daily Mission ── */}
          <motion.div variants={cardVariants} className="lg:col-span-3">
            <div className="h-full bg-surface rounded-2xl border border-border shadow-sm p-5 md:p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gold-light flex items-center justify-center">
                    <Target size={16} className="text-gold" strokeWidth={2.2} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-widest leading-none">
                      Daily Mission
                    </p>
                    <p className="text-xs text-ink-muted leading-none mt-0.5">Resets at midnight</p>
                  </div>
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
                        {mission.progress} / {mission.target_count} zones
                      </span>
                    </div>
                    <div className="h-2 bg-brand-light rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-dark rounded-full transition-all duration-700"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-ink-faint mt-1 text-right">{progressPct}%</p>
                  </div>

                  <button
                    onClick={scrollToMap}
                    className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-brand hover:bg-brand-dark text-ink font-semibold text-sm rounded-full transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
                  >
                    <CheckCircle2 size={15} />
                    Start Mission
                  </button>
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
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gold-light flex items-center justify-center">
                    <Trophy size={15} className="text-gold" strokeWidth={2.2} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-widest leading-none">
                      This Week
                    </p>
                    <p className="text-xs text-ink-muted leading-none mt-0.5">Top Contributors</p>
                  </div>
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
                  <span className="font-semibold text-ink">#—</span>
                </div>
                <div className="mt-1.5 h-1.5 bg-brand-light rounded-full overflow-hidden">
                  <div className="h-full bg-brand rounded-full" style={{ width: "34%" }} />
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── 5. Library Map ── */}
        <motion.div variants={cardVariants} id="library-map">
          <div className="bg-surface rounded-2xl border border-border shadow-sm p-5 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-widest leading-none">
                  Tay Eng Soon Library
                </p>
                <p className="text-base font-bold text-ink mt-0.5">Live Zone Status</p>
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

            {/* Location cards */}
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

      </motion.div>
    </>
  );
}
