"use client";

/**
 * Spot Detail Page — /location/[id]
 *
 * Requires (if not yet installed):
 *   npm install @radix-ui/react-tabs @radix-ui/react-dialog html5-qrcode
 *
 * Supabase wiring:
 *   Replace MOCK_LOCATION, MOCK_STATUS_LOGS, MOCK_REVIEWS, MOCK_STUDY_GROUPS
 *   with real fetch calls using the `id` param. All shapes match the schema.
 */

import { use, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import * as Tabs from "@radix-ui/react-tabs";
import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  QrCode,
  Share2,
  MapPin,
  Users,
  Clock,
  CheckCircle2,
  X,
  BookOpen,
  UserCircle,
  Coins,
  Plus,
  AlertCircle,
} from "lucide-react";

// ─────────────────────────────────────────────
// Types  (shapes match Supabase schema exactly)
// ─────────────────────────────────────────────

type LocationStatus = "empty" | "busy" | "full";

type LocationDetail = {
  id: number;
  name: string;
  category: string;
  current_status: LocationStatus;
  image_url: string | null;
  coordinates_x: number;
  coordinates_y: number;
  description: string;
  capacity: number;
  floor: string;
  building: string;
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
// Mock data  ← swap with Supabase fetches on id
// ─────────────────────────────────────────────

const MOCK_LOCATION: LocationDetail = {
  id: 1,
  name: "Main IT Lab",
  category: "IT Lab",
  current_status: "busy",
  image_url: null,
  coordinates_x: 35,
  coordinates_y: 40,
  description:
    "A 40-seat computer lab equipped with high-speed internet, programming IDEs, and the Adobe Creative Suite. Perfect for coding sessions and design projects.",
  capacity: 40,
  floor: "Level 3",
  building: "SIM HQ",
};

const MOCK_STATUS_LOGS: StatusLog[] = [
  { id: 1, status: "busy",  created_at: "2026-03-17T09:45:00Z", profiles: { username: "sarah_l"  } },
  { id: 2, status: "empty", created_at: "2026-03-17T09:10:00Z", profiles: { username: "marcus_t" } },
  { id: 3, status: "full",  created_at: "2026-03-17T08:55:00Z", profiles: { username: "priya_k"  } },
  { id: 4, status: "busy",  created_at: "2026-03-17T08:30:00Z", profiles: { username: "alex_w"   } },
];

const MOCK_REVIEWS: Review[] = [
  {
    id: 1,
    rating: 5,
    comment: "Perfect for long study sessions. Fast computers and very quiet environment.",
    created_at: "2026-03-15T14:30:00Z",
    profiles: { username: "sarah_l", avatar_url: null },
  },
  {
    id: 2,
    rating: 4,
    comment: "Great lab but can get crowded after 11am. Arrive early for a guaranteed seat!",
    created_at: "2026-03-14T11:20:00Z",
    profiles: { username: "alex_w", avatar_url: null },
  },
  {
    id: 3,
    rating: 3,
    comment: "Some computers were running slow today. Usually better. Still a solid spot.",
    created_at: "2026-03-13T16:00:00Z",
    profiles: { username: "priya_k", avatar_url: null },
  },
];

const MOCK_STUDY_GROUPS: StudyGroup[] = [
  {
    id: 1,
    subject: "Data Structures & Algorithms",
    current_members: 3,
    max_members: 5,
    is_active: true,
    created_at: "2026-03-17T09:00:00Z",
    profiles: { username: "sarah_l" },
  },
  {
    id: 2,
    subject: "Web Dev — React & Next.js",
    current_members: 2,
    max_members: 4,
    is_active: true,
    created_at: "2026-03-17T08:30:00Z",
    profiles: { username: "marcus_t" },
  },
];

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
        <span key={s} className={s <= rating ? "text-gold" : "text-ink-faint"}>
          ★
        </span>
      ))}
    </div>
  );
}

function CrowdMeter({ status }: { status: LocationStatus }) {
  const filled =
    status === "empty" ? 1 : status === "busy" ? 3 : 5;
  const color =
    status === "empty" ? "bg-success" : status === "busy" ? "bg-gold" : "bg-alert";
  return (
    <div className="flex gap-1 items-center" aria-label={`Crowd level: ${status}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 w-4 rounded-full transition-colors duration-300 ${
            i < filled ? color : "bg-surface/30"
          }`}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// QR Scanner Modal
// Uses dynamic import of html5-qrcode to avoid SSR issues.
// html5-qrcode renders its own camera UI inside #qr-scanner-region.
// ─────────────────────────────────────────────

function QrScannerDialog({
  open,
  onClose,
  locationName,
}: {
  open: boolean;
  onClose: () => void;
  locationName: string;
}) {
  const [scanResult, setScanResult]   = useState<string | null>(null);
  const [scanError, setScanError]     = useState<string | null>(null);
  const scannerRef = useRef<{ clear: () => Promise<void> } | null>(null);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      await scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopScanner();
      setScanResult(null);
      setScanError(null);
      return;
    }

    let cancelled = false;

    // setTimeout ensures the Dialog portal has mounted the DOM element
    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        const { Html5QrcodeScanner } = await import("html5-qrcode");
        if (cancelled || !document.getElementById("qr-scanner-region")) return;

        const scanner = new Html5QrcodeScanner(
          "qr-scanner-region",
          { fps: 10, qrbox: { width: 230, height: 230 }, rememberLastUsedCamera: true },
          /* verbose= */ false
        );

        scanner.render(
          (decodedText) => {
            // TODO: validate decodedText against location.qr_token in Supabase,
            // then award points via point_rules and log to status_logs
            setScanResult(decodedText);
            scanner.clear().catch(() => {});
          },
          () => {
            // Scan failures fire on every frame without a QR code — intentionally ignored
          }
        );

        scannerRef.current = scanner;
      } catch {
        setScanError("Could not start the camera. Please allow camera access and try again.");
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopScanner();
    };
  }, [open, stopScanner]);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Panel */}
        <Dialog.Content
          aria-describedby="qr-dialog-desc"
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 bg-surface rounded-2xl shadow-xl p-6 outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-1">
            <Dialog.Title className="text-base font-bold text-ink leading-tight">
              Scan QR to Check-in
            </Dialog.Title>
            <Dialog.Close
              onClick={onClose}
              className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-brand-faint transition-colors"
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          <p id="qr-dialog-desc" className="text-xs text-ink-muted mb-4">
            Point your camera at the QR code posted at{" "}
            <span className="font-medium text-ink">{locationName}</span>.
          </p>

          {/* Success state */}
          {scanResult ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-success-light flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={28} className="text-success" />
              </div>
              <p className="text-base font-bold text-ink">Check-in Successful!</p>
              <p className="text-xs text-ink-muted mt-1">
                You've earned points for contributing crowd data.
              </p>
              <button
                onClick={onClose}
                className="mt-5 w-full py-2.5 text-sm font-semibold bg-brand hover:bg-brand-dark text-ink rounded-full transition-colors"
              >
                Done
              </button>
            </div>
          ) : scanError ? (
            /* Error state */
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-alert-light flex items-center justify-center mx-auto mb-3">
                <AlertCircle size={26} className="text-alert" />
              </div>
              <p className="text-sm font-semibold text-ink">Camera access needed</p>
              <p className="text-xs text-ink-muted mt-1">{scanError}</p>
              <button
                onClick={onClose}
                className="mt-5 w-full py-2.5 text-sm font-medium bg-canvas border border-border text-ink-muted rounded-full transition-colors hover:bg-brand-faint"
              >
                Cancel
              </button>
            </div>
          ) : (
            /* Scanner state */
            <>
              {/* html5-qrcode mounts its camera UI here */}
              <div id="qr-scanner-region" className="overflow-hidden rounded-xl" />
              <button
                onClick={onClose}
                className="mt-4 w-full py-2.5 text-sm font-medium text-ink-muted bg-canvas border border-border rounded-full hover:bg-brand-faint transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

const containerVariants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

export default function LocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);  // Next.js 15 — unwrap the params Promise

  // TODO: replace MOCK_LOCATION with:
  //   const supabase = createClient();
  //   const { data } = await supabase.from("locations").select("*").eq("id", id).single();
  const location = MOCK_LOCATION;

  const [activeStatus, setActiveStatus] = useState<LocationStatus>(location.current_status);
  const [statusLogs,   setStatusLogs]   = useState<StatusLog[]>(MOCK_STATUS_LOGS);
  const [qrOpen,       setQrOpen]       = useState(false);
  const [submitState,  setSubmitState]  = useState<"idle" | "submitting" | "done">("idle");

  const s = STATUS_CONFIG[activeStatus];

  const handleStatusUpdate = async (newStatus: LocationStatus) => {
    if (newStatus === activeStatus) return;
    setSubmitState("submitting");

    // TODO: replace with Supabase mutation:
    //   await supabase.from("status_logs").insert({ location_id: id, user_id: session.user.id, status: newStatus })
    //   await supabase.from("locations").update({ current_status: newStatus }).eq("id", id)
    await new Promise((r) => setTimeout(r, 600)); // simulate network

    setActiveStatus(newStatus);
    setStatusLogs((prev) => [
      { id: Date.now(), status: newStatus, created_at: new Date().toISOString(), profiles: { username: "you" } },
      ...prev,
    ]);
    setSubmitState("done");
    setTimeout(() => setSubmitState("idle"), 2000);
  };

  // Suppress unused-variable warning — id is for the Supabase fetch above
  void id;

  return (
    <>
      <QrScannerDialog
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        locationName={location.name}
      />

      <motion.div variants={containerVariants} initial="hidden" animate="show">

        {/* ── Hero Banner ── */}
        <motion.div variants={cardVariants}>
          <div className="relative h-56 md:h-72 w-full overflow-hidden">
            {/* Gradient placeholder — swap for <Image> when image_url is available */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand via-brand-dark to-[#6BA8B4]" />

            {/* Dark scrim for text legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-ink/65 via-ink/15 to-transparent" />

            {/* Back button */}
            <Link
              href="/location"
              className="absolute top-4 left-4 flex items-center gap-1.5 bg-surface/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium text-ink border border-border/50 hover:bg-surface transition-colors shadow-sm"
            >
              <ChevronLeft size={13} />
              Back
            </Link>

            {/* Location info overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 bg-surface/90 backdrop-blur-sm rounded-full text-xs font-semibold text-ink-muted border border-border/50">
                  {location.category}
                </span>
                <CrowdMeter status={activeStatus} />
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${s.bg} ${s.text} border ${s.border}`}
                >
                  ● {s.label}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-surface leading-tight">
                {location.name}
              </h1>
              <p className="text-sm text-surface/75 mt-1 flex items-center gap-1.5">
                <MapPin size={12} className="shrink-0" />
                {location.floor} · {location.building} · Capacity {location.capacity}
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Sticky Action Bar ── */}
        <div className="sticky top-16 z-10 bg-surface/80 backdrop-blur-md border-b border-border">
          <div className="max-w-3xl mx-auto px-4 md:px-6 py-3 flex items-center gap-3">
            <button
              onClick={() => setQrOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand hover:bg-brand-dark text-ink font-semibold text-sm rounded-full transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
            >
              <QrCode size={16} />
              Scan QR to Check-in
            </button>
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

          {/* Description */}
          <motion.p variants={cardVariants} className="text-sm text-ink-muted leading-relaxed">
            {location.description}
          </motion.p>

          {/* ── Radix Tabs ── */}
          <motion.div variants={cardVariants}>
            <Tabs.Root defaultValue="live-status">

              {/* Tab list */}
              <Tabs.List className="flex gap-1 p-1 bg-canvas rounded-xl border border-border mb-5">
                {[
                  { value: "live-status", label: "Live Status",       icon: <Clock size={13} />   },
                  { value: "reviews",     label: "Reviews & Buddies", icon: <BookOpen size={13} /> },
                ].map(({ value, label, icon }) => (
                  <Tabs.Trigger
                    key={value}
                    value={value}
                    className="
                      flex-1 flex items-center justify-center gap-1.5
                      py-2 text-sm font-medium rounded-lg
                      text-ink-muted transition-all duration-200
                      data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-sm
                      hover:text-ink
                    "
                  >
                    {icon}
                    {label}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>

              {/* ── Tab 1: Live Status ── */}
              <Tabs.Content value="live-status" className="space-y-5 outline-none">

                {/* Crowd meter card */}
                <div className={`bg-surface rounded-2xl border ${s.border} p-5 shadow-sm`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-ink-faint uppercase tracking-widest">
                      Current Status
                    </p>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>
                      ● {s.label}
                    </span>
                  </div>
                  {/* Capacity bar */}
                  <div className="h-3 bg-canvas rounded-full overflow-hidden border border-border">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${s.dot} ${s.barWidth}`}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-ink-faint mt-1.5">
                    <span>Empty</span>
                    <span>Full ({location.capacity} seats)</span>
                  </div>
                </div>

                {/* Status update buttons */}
                <div>
                  <p className="text-xs font-semibold text-ink-muted mb-3 flex items-center gap-1.5">
                    <Coins size={12} className="text-gold" />
                    Update crowd status · Earn{" "}
                    <span className="text-gold font-bold">+10 pts</span>
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
                        <span className="text-[10px] font-normal opacity-75 leading-tight">
                          {description}
                        </span>
                        {/* Active checkmark */}
                        {activeStatus === value && (
                          <span className="absolute top-2 right-2">
                            <CheckCircle2 size={13} />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Submit feedback */}
                  {submitState === "submitting" && (
                    <p className="text-xs text-ink-muted text-center mt-3 animate-pulse">
                      Saving your update…
                    </p>
                  )}
                  {submitState === "done" && (
                    <p className="text-xs text-success text-center mt-3 font-medium">
                      ✓ Status updated · +10 pts earned!
                    </p>
                  )}
                </div>

                {/* Recent status logs */}
                <div>
                  <p className="text-xs font-semibold text-ink-faint uppercase tracking-widest mb-3">
                    Recent Updates
                  </p>
                  <div className="space-y-2">
                    {statusLogs.map((log) => {
                      const logStatus = (log.status as LocationStatus) in STATUS_CONFIG
                        ? (log.status as LocationStatus)
                        : "empty";
                      const logS = STATUS_CONFIG[logStatus];
                      return (
                        <div
                          key={log.id}
                          className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border"
                        >
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${logS.dot}`} />
                          <div className="flex-1 min-w-0">
                            <span className={`text-xs font-semibold ${logS.text}`}>
                              {logS.label}
                            </span>
                            <span className="text-xs text-ink-muted ml-1.5">
                              by{" "}
                              <span className="font-medium text-ink">
                                @{log.profiles.username}
                              </span>
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
              </Tabs.Content>

              {/* ── Tab 2: Reviews & Buddies ── */}
              <Tabs.Content value="reviews" className="space-y-6 outline-none">

                {/* ─ Active Study Groups ─ */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-ink-faint uppercase tracking-widest">
                      Active Study Groups
                    </p>
                    <button className="flex items-center gap-1 text-xs font-medium text-brand-dark hover:text-ink transition-colors">
                      <Plus size={12} />
                      Create group
                    </button>
                  </div>

                  {MOCK_STUDY_GROUPS.length === 0 ? (
                    <div className="text-center py-8 text-sm text-ink-muted bg-surface rounded-2xl border border-border">
                      No study groups here yet.{" "}
                      <span className="text-brand-dark font-medium cursor-pointer">
                        Start one!
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {MOCK_STUDY_GROUPS.map((group) => {
                        const spotsLeft = group.max_members - group.current_members;
                        const full = spotsLeft === 0;
                        return (
                          <div
                            key={group.id}
                            className="flex items-center gap-3 p-4 bg-surface rounded-2xl border border-border hover:border-brand transition-colors duration-200"
                          >
                            <div className="w-10 h-10 rounded-xl bg-brand-faint flex items-center justify-center shrink-0">
                              <BookOpen size={16} className="text-brand-dark" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-ink truncate leading-tight">
                                {group.subject}
                              </p>
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
                              <button
                                disabled={full}
                                className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                                  full
                                    ? "bg-canvas text-ink-faint border border-border cursor-not-allowed"
                                    : "bg-brand hover:bg-brand-dark text-ink"
                                }`}
                              >
                                {full ? "Full" : `Join (${spotsLeft} left)`}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ─ Reviews ─ */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-ink-faint uppercase tracking-widest">
                      Reviews
                    </p>
                    <div className="flex items-center gap-1 text-xs text-ink-muted">
                      <span className="text-gold">★</span>
                      <span className="font-semibold text-ink">
                        {(
                          MOCK_REVIEWS.reduce((s, r) => s + r.rating, 0) / MOCK_REVIEWS.length
                        ).toFixed(1)}
                      </span>
                      <span>· {MOCK_REVIEWS.length} reviews</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {MOCK_REVIEWS.map((review) => (
                      <div
                        key={review.id}
                        className="p-4 bg-surface rounded-2xl border border-border"
                      >
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
                </div>

              </Tabs.Content>
            </Tabs.Root>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}
