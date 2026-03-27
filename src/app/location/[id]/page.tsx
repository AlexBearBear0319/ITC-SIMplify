"use client";

import { use, useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import * as Tabs from "@radix-ui/react-tabs";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { awardPoints, POINT_ACTIONS } from "@/lib/db/points";
import QRScannerModal from "@/components/features/QRScannerModal";
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
} from "lucide-react";

// ─────────────────────────────────────────────
// Types  (shapes match Supabase schema exactly)
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
  subject: string;
  current_members: number;
  max_members: number;
  is_active: boolean;
  created_at: string;
  profiles: { username: string };
};

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────

const STATUS_CONFIG: Record<
  LocationStatus,
  { label: string; dot: string; text: string; bg: string; border: string; barWidth: string }
> = {
  empty: { label: "Empty",  dot: "bg-success", text: "text-success", bg: "bg-success-light", border: "border-success/40",  barWidth: "w-1/5"   },
  busy:  { label: "Busy",   dot: "bg-gold",    text: "text-gold",    bg: "bg-gold-light",    border: "border-gold/40",    barWidth: "w-3/5"   },
  full:  { label: "Full",   dot: "bg-alert",   text: "text-alert",   bg: "bg-alert-light",   border: "border-alert/40",   barWidth: "w-full"  },
};

const STATUS_UPDATE_OPTIONS: {
  value: LocationStatus;
  label: string;
  description: string;
  emoji: string;
  activeClasses: string;
  inactiveClasses: string;
}[] = [
  {
    value: "empty",
    label: "Empty",
    description: "Plenty of seats available",
    emoji: "🟢",
    activeClasses:   "bg-success border-success text-ink shadow-md scale-[1.02]",
    inactiveClasses: "bg-success-light border-success/30 text-success hover:scale-[1.01] hover:shadow-sm",
  },
  {
    value: "busy",
    label: "Busy",
    description: "Some seats taken",
    emoji: "🟡",
    activeClasses:   "bg-gold border-gold text-ink shadow-md scale-[1.02]",
    inactiveClasses: "bg-gold-light border-gold/30 text-gold hover:scale-[1.01] hover:shadow-sm",
  },
  {
    value: "full",
    label: "Full",
    description: "No seats available",
    emoji: "🔴",
    activeClasses:   "bg-alert border-alert text-surface shadow-md scale-[1.02]",
    inactiveClasses: "bg-alert-light border-alert/30 text-alert hover:scale-[1.01] hover:shadow-sm",
  },
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
        <div
          key={i}
          className={`h-1.5 w-4 rounded-full transition-colors duration-300 ${i < filled ? color : "bg-surface/30"}`}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Animation variants
// ─────────────────────────────────────────────

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

const containerVariants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function LocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const locationId = Number(id);
  const supabase = useMemo(() => createClient(), []);

  const [location,      setLocation]      = useState<LocationDetail | null>(null);
  const [statusLogs,    setStatusLogs]    = useState<StatusLog[]>([]);
  const [reviews,       setReviews]       = useState<Review[]>([]);
  const [studyGroups,   setStudyGroups]   = useState<StudyGroup[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [activeStatus,  setActiveStatus]  = useState<LocationStatus>("empty");
  const [qrOpen,        setQrOpen]        = useState(false);
  const [submitState,   setSubmitState]   = useState<"idle" | "submitting" | "done">("idle");
  const [pointsDelta,   setPointsDelta]   = useState<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [checkInDone,   setCheckInDone]   = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      const [locRes, logsRes, revsRes, groupsRes] = await Promise.all([
        supabase
          .from("locations")
          .select("id, name, category, current_status, image_url, coordinates_x, coordinates_y, description, total_seats, location_text")
          .eq("id", locationId)
          .single(),
        supabase
          .from("status_logs")
          .select("id, status, created_at, profiles(username)")
          .eq("location_id", locationId)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("reviews")
          .select("id, rating, comment, created_at, profiles(username, avatar_url)")
          .eq("location_id", locationId)
          .order("created_at", { ascending: false }),
        supabase
          .from("study_groups")
          .select("id, subject, current_members, max_members, is_active, created_at, profiles(username)")
          .eq("location_id", locationId)
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
      ]);

      if (locRes.data) {
        const loc = locRes.data as LocationDetail;
        setLocation(loc);
        setActiveStatus((loc.current_status ?? "empty") as LocationStatus);
      }
      setStatusLogs((logsRes.data ?? []) as unknown as StatusLog[]);
      setReviews((revsRes.data ?? []) as unknown as Review[]);
      setStudyGroups((groupsRes.data ?? []) as unknown as StudyGroup[]);
      setLoading(false);
    }
    load();
  }, [locationId, supabase]);

  const handleStatusUpdate = async (newStatus: LocationStatus) => {
    if (!location || newStatus === activeStatus) return;
    setSubmitState("submitting");
    await supabase
      .from("status_logs")
      .insert({ location_id: locationId, user_id: currentUserId, status: newStatus });
    await supabase
      .from("locations")
      .update({ current_status: newStatus })
      .eq("id", locationId);
    setActiveStatus(newStatus);
    setStatusLogs((prev) => [
      { id: Date.now(), status: newStatus, created_at: new Date().toISOString(), profiles: { username: "you" } },
      ...prev,
    ]);
    setSubmitState("done");
    setTimeout(() => setSubmitState("idle"), 2000);
  };

  const handleCheckIn = useCallback(async (_scannedLocationId: number) => {
    if (!currentUserId) return;

    // Create active session record
    await supabase.from("active_sessions").insert({
      user_id:          currentUserId,
      location_id:      locationId,
      seats_taken:      1,
      activity:         "solo_study",
      duration_minutes: 60,
      is_active:        true,
    });

    // Look up how many points check_in gives, then award them
    const { data: rule } = await supabase
      .from("point_rules")
      .select("points_awarded")
      .eq("action_name", POINT_ACTIONS.CHECK_IN)
      .eq("is_active", true)
      .maybeSingle();
    const pts = (rule as { points_awarded: number } | null)?.points_awarded ?? 10;

    await awardPoints(supabase, currentUserId, POINT_ACTIONS.CHECK_IN);

    setPointsDelta(pts);
    setCheckInDone(true);
    setTimeout(() => setPointsDelta(null), 2500);
  }, [currentUserId, locationId, supabase]);

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
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return (
    <>
      <QRScannerModal
        open={qrOpen}
        locationName={location.name}
        onOpenChange={(open) => { if (!open) setQrOpen(false); }}
        onSuccess={handleCheckIn}
        requiredLocationId={locationId}
      />

      {/* Floating points animation */}
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

            <Link
              href="/location"
              className="absolute top-4 left-4 flex items-center gap-1.5 bg-surface/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium text-ink border border-border/50 hover:bg-surface transition-colors shadow-sm"
            >
              <ChevronLeft size={13} />
              Back
            </Link>

            <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {location.category && (
                  <span className="px-2.5 py-0.5 bg-surface/90 backdrop-blur-sm rounded-full text-xs font-semibold text-ink-muted border border-border/50">
                    {location.category}
                  </span>
                )}
                <CrowdMeter status={activeStatus} />
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${s.bg} ${s.text} border ${s.border}`}>
                  ● {s.label}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-surface leading-tight">
                {location.name}
              </h1>
              <p className="text-sm text-surface/75 mt-1 flex items-center gap-1.5">
                <MapPin size={12} className="shrink-0" />
                {[location.location_text, location.total_seats ? `Capacity ${location.total_seats}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Sticky Action Bar — two distinct CTAs ── */}
        <div className="sticky top-16 z-10 bg-surface/80 backdrop-blur-md border-b border-border">
          <div className="max-w-3xl mx-auto px-4 md:px-6 py-3 flex items-center gap-2">
            {/* Solo Check-in */}
            <button
              onClick={() => setQrOpen(true)}
              disabled={checkInDone}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand hover:bg-brand-dark text-ink font-semibold text-sm rounded-full transition-all duration-200 hover:shadow-sm active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {checkInDone ? (
                <><CheckCircle2 size={16} /> Checked In</>
              ) : (
                <><QrCode size={16} /> Solo Check-in</>
              )}
            </button>

            {/* Study Buddy — navigates to finder pre-filtered by this location */}
            <Link
              href={`/finder?locationId=${locationId}`}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-canvas border border-border hover:bg-brand-faint text-ink-muted hover:text-ink font-semibold text-sm rounded-full transition-all duration-200"
            >
              <Users size={16} />
              Study Buddy
            </Link>

            <button
              aria-label="Share location"
              className="p-2.5 bg-canvas border border-border rounded-full text-ink-muted hover:text-ink hover:bg-brand-faint transition-colors duration-200"
            >
              <Share2 size={16} />
            </button>
          </div>
        </div>

        {/* ── Page Body ── */}
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-5 md:py-6 space-y-4">

          {/* Checked-in banner */}
          <AnimatePresence>
            {checkInDone && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 px-4 py-3 bg-success-light border border-success/30 rounded-2xl"
              >
                <CheckCircle2 size={16} className="text-success shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-ink">Checked in successfully!</p>
                  <p className="text-xs text-ink-muted">Your presence at {location.name} is logged.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {location.description && (
            <motion.p variants={cardVariants} className="text-sm text-ink-muted leading-relaxed">
              {location.description}
            </motion.p>
          )}

          {/* ── Radix Tabs ── */}
          <motion.div variants={cardVariants}>
            <Tabs.Root defaultValue="live-status">

              <Tabs.List className="flex gap-1 p-1 bg-canvas rounded-xl border border-border mb-5">
                {[
                  { value: "live-status", label: "Live Status",       icon: <Clock size={13} />   },
                  { value: "reviews",     label: "Reviews & Buddies", icon: <BookOpen size={13} /> },
                ].map(({ value, label, icon }) => (
                  <Tabs.Trigger
                    key={value}
                    value={value}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg text-ink-muted transition-all duration-200 data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-sm hover:text-ink"
                  >
                    {icon}
                    {label}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>

              {/* ── Tab 1: Live Status ── */}
              <Tabs.Content value="live-status" className="space-y-5 outline-none">

                {/* Crowd meter */}
                <div className={`bg-surface rounded-2xl border ${s.border} p-5 shadow-sm`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-ink-faint uppercase tracking-widest">Current Status</p>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>● {s.label}</span>
                  </div>
                  <div className="h-3 bg-canvas rounded-full overflow-hidden border border-border">
                    <div className={`h-full rounded-full transition-all duration-700 ${s.dot} ${s.barWidth}`} />
                  </div>
                  <div className="flex justify-between text-[10px] text-ink-faint mt-1.5">
                    <span>Empty</span>
                    <span>Full{location.total_seats ? ` (${location.total_seats} seats)` : ""}</span>
                  </div>
                </div>

                {/* Status update buttons */}
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
                        className={`
                          relative flex flex-col items-center gap-1.5 p-4 rounded-2xl border-2
                          text-center font-semibold transition-all duration-200
                          disabled:opacity-60 disabled:cursor-not-allowed
                          ${activeStatus === value ? activeClasses : inactiveClasses}
                        `}
                      >
                        <span className="text-xl leading-none">{emoji}</span>
                        <span className="text-sm">{label}</span>
                        <span className="text-[10px] font-normal opacity-75 leading-tight">{description}</span>
                        {activeStatus === value && (
                          <span className="absolute top-2 right-2"><CheckCircle2 size={13} /></span>
                        )}
                      </button>
                    ))}
                  </div>
                  {submitState === "submitting" && (
                    <p className="text-xs text-ink-muted text-center mt-3 animate-pulse">Saving your update…</p>
                  )}
                  {submitState === "done" && (
                    <p className="text-xs text-success text-center mt-3 font-medium">✓ Status updated!</p>
                  )}
                </div>

                {/* Recent status logs */}
                {statusLogs.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-ink-faint uppercase tracking-widest mb-3">Recent Updates</p>
                    <div className="space-y-2">
                      {statusLogs.map((log) => {
                        const logStatus = (log.status as LocationStatus) in STATUS_CONFIG
                          ? (log.status as LocationStatus) : "empty";
                        const logS = STATUS_CONFIG[logStatus];
                        return (
                          <div key={log.id} className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${logS.dot}`} />
                            <div className="flex-1 min-w-0">
                              <span className={`text-xs font-semibold ${logS.text}`}>{logS.label}</span>
                              <span className="text-xs text-ink-muted ml-1.5">
                                by <span className="font-medium text-ink">@{log.profiles.username}</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-ink-faint shrink-0">
                              <Clock size={10} />
                              {timeAgo(log.created_at)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Tabs.Content>

              {/* ── Tab 2: Reviews & Buddies ── */}
              <Tabs.Content value="reviews" className="space-y-6 outline-none">

                {/* Active Study Groups */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-ink-faint uppercase tracking-widest">Active Study Groups</p>
                    <Link
                      href={`/finder?locationId=${locationId}`}
                      className="flex items-center gap-1 text-xs font-medium text-brand-dark hover:text-ink transition-colors"
                    >
                      <Plus size={12} />
                      Create group
                    </Link>
                  </div>

                  {studyGroups.length === 0 ? (
                    <div className="text-center py-8 text-sm text-ink-muted bg-surface rounded-2xl border border-border">
                      No study groups here yet.{" "}
                      <Link href={`/finder?locationId=${locationId}`} className="text-brand-dark font-medium">
                        Start one!
                      </Link>
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
                              <p className="text-xs text-ink-muted mt-0.5 flex items-center gap-1.5">
                                <UserCircle size={11} />
                                Host: @{group.profiles.username}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="flex items-center gap-1 text-xs text-ink-muted mb-1.5">
                                <Users size={11} />
                                {group.current_members}/{group.max_members}
                              </div>
                              <Link
                                href={`/finder?locationId=${locationId}`}
                                className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                                  full
                                    ? "bg-canvas text-ink-faint border border-border pointer-events-none"
                                    : "bg-brand hover:bg-brand-dark text-ink"
                                }`}
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

                {/* Reviews */}
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
                    <div className="text-center py-8 text-sm text-ink-muted bg-surface rounded-2xl border border-border">
                      No reviews yet. Be the first!
                    </div>
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
                                <p className="text-sm font-semibold text-ink leading-tight">
                                  @{review.profiles.username}
                                </p>
                                <StarRating rating={review.rating} />
                              </div>
                            </div>
                            <span className="text-[10px] text-ink-faint shrink-0 flex items-center gap-1 mt-0.5">
                              <Clock size={10} />
                              {timeAgo(review.created_at)}
                            </span>
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
