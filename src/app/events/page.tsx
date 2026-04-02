"use client";

/**
 * Campus Events & Schedule — /events
 *
 * Requires (run before starting):
 *   npm install react-day-picker date-fns
 *
 * Uses react-day-picker v9 with a FULL Tailwind classNames override —
 * no react-day-picker/style.css import needed.
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { isTextUIPart } from "ai";
import { DayPicker } from "react-day-picker";
import type { DayButtonProps } from "react-day-picker";
import { format, isSameDay, parseISO, startOfMonth } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  MapPin,
  AlertTriangle,
  AlertCircle,
  Users,
  Zap,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─────────────────────────────────────────────
// Types  (matches events table schema exactly)
// ─────────────────────────────────────────────

type CalendarEvent = {
  id: number;
  title: string;
  description: string | null;
  event_date: string;      // ISO 8601 string
  location_id: number | null;
  is_peak_alert: boolean;
  location_name?: string | null;
};

type SuggestionMood = "neutral" | "warning" | "danger";

type SuggestionSpot = { name: string; highlight: string; locationId: number };

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getEventsForDate(date: Date, events: CalendarEvent[]): CalendarEvent[] {
  return events.filter((e) => isSameDay(parseISO(e.event_date), date));
}

type EventStyle = { Icon: LucideIcon; bg: string; border: string; iconBg: string; iconColor: string };

function getEventStyle(event: CalendarEvent): EventStyle {
  if (event.is_peak_alert)
    return {
      Icon: AlertTriangle,
      bg: "bg-alert-light",
      border: "border-alert/30",
      iconBg: "bg-alert/20",
      iconColor: "text-alert",
    };
  if (/workshop|seminar|bootcamp|talk|lecture/i.test(event.title))
    return {
      Icon: Zap,
      bg: "bg-gold-light",
      border: "border-gold/30",
      iconBg: "bg-gold/20",
      iconColor: "text-gold",
    };
  if (/fair|orientation|expo|welcome|freshm/i.test(event.title))
    return {
      Icon: Users,
      bg: "bg-brand-faint",
      border: "border-brand/30",
      iconBg: "bg-brand/20",
      iconColor: "text-brand-dark",
    };
  return {
    Icon: CalendarDays,
    bg: "bg-surface",
    border: "border-border",
    iconBg: "bg-canvas",
    iconColor: "text-ink-muted",
  };
}

function getEventMood(events: CalendarEvent[]): SuggestionMood {
  if (events.some((e) => /exam/i.test(e.title))) return "danger";
  if (events.some((e) => e.is_peak_alert || /fair|orientation|expo|welcome/i.test(e.title))) return "warning";
  return "neutral";
}

function getQuickSpots(mood: SuggestionMood, spots: SuggestionSpot[]) {
  if (spots.length === 0) return [];
  if (mood === "danger")  return spots.slice(0, Math.min(2, spots.length));
  if (mood === "warning") return spots.slice(Math.min(1, spots.length - 1), Math.min(3, spots.length));
  return spots.slice(0, Math.min(3, spots.length));
}

function formatReadableAiText(raw: string): string {
  return raw
    .replace(/\[([^\]]+)\]\((\/location\/\d+)\)/g, "$1: $2")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*-\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─────────────────────────────────────────────
// Animation variants
// ─────────────────────────────────────────────

const fadeSlide = {
  initial: { opacity: 0, x: 10 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  exit:    { opacity: 0, x: -10, transition: { duration: 0.15 } },
};

const pageEntry = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.1 } },
};

const blockEntry = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

// ─────────────────────────────────────────────
// react-day-picker — full Tailwind classNames override
// ─────────────────────────────────────────────

const CAL_CLASSES: Record<string, string> = {
  root:            "w-full select-none",
  months:          "w-full",
  month:           "w-full",
  month_caption:   "flex items-center justify-between px-1 mb-2 h-9",
  caption_label:   "text-sm font-bold text-ink",
  nav:             "flex items-center gap-1",
  button_previous: [
    "w-8 h-8 flex items-center justify-center rounded-xl",
    "text-ink-muted hover:text-ink hover:bg-brand-faint",
    "transition-colors duration-150 disabled:opacity-25 disabled:pointer-events-none",
  ].join(" "),
  button_next: [
    "w-8 h-8 flex items-center justify-center rounded-xl",
    "text-ink-muted hover:text-ink hover:bg-brand-faint",
    "transition-colors duration-150 disabled:opacity-25 disabled:pointer-events-none",
  ].join(" "),
  month_grid: "w-full border-collapse",
  weekdays:   "",
  weekday:    "text-center text-[10px] font-bold text-ink-faint py-2 uppercase tracking-wider",
  weeks:      "",
  week:       "",
  day:        "p-[3px] text-center align-middle",
  day_button: [
    "w-9 h-9 mx-auto rounded-xl text-sm font-medium",
    "flex items-center justify-center relative",
    "transition-all duration-150 outline-none",
    "hover:bg-brand-faint hover:text-ink",
    "focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1",
    "text-ink cursor-pointer",
  ].join(" "),
  today:    "font-extrabold text-brand-dark",
  selected: "bg-brand! text-ink! font-bold! shadow-sm! hover:bg-brand-dark!",
  outside:  "opacity-30! cursor-default!",
  disabled: "opacity-20! cursor-not-allowed!",
  hidden:   "invisible",
};

// ─────────────────────────────────────────────
// CustomDayButton — adds event/peak dot indicators
// ─────────────────────────────────────────────

function CustomDayButton({ day: _day, modifiers, className, children, ...rest }: DayButtonProps) {
  const hasEvent = Boolean(modifiers.hasEvent);
  const isPeak   = Boolean(modifiers.isPeak);
  const selected = Boolean(modifiers.selected);

  return (
    <button className={className} {...rest}>
      {children}
      {(hasEvent || isPeak) && (
        <span
          className={`
            absolute bottom-0.5 left-1/2 -translate-x-1/2
            w-1 h-1 rounded-full transition-colors duration-150
            ${selected
              ? "bg-surface"
              : isPeak ? "bg-alert" : "bg-brand-dark"
            }
          `}
        />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────
// EventCard
// ─────────────────────────────────────────────

function EventCard({ event, locationName }: { event: CalendarEvent; locationName: string | null }) {
  const { Icon, bg, border, iconBg, iconColor } = getEventStyle(event);
  const timeStr = format(parseISO(event.event_date), "h:mm a");

  return (
    <div className={`flex gap-3 p-4 rounded-2xl border ${bg} ${border}`}>
      {/* Icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon size={16} className={iconColor} strokeWidth={2.2} />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-ink leading-tight">{event.title}</p>
        <p className="text-xs text-ink-muted mt-1 leading-relaxed line-clamp-2">
          {event.description}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
          <span className="flex items-center gap-1 text-[11px] text-ink-muted">
            <Clock size={10} className="shrink-0" />
            {timeStr}
          </span>
          {locationName && (
            <Link
              href={`/location/${event.location_id}`}
              className="flex items-center gap-1 text-[11px] text-brand-dark hover:text-ink transition-colors"
            >
              <MapPin size={10} className="shrink-0" />
              {locationName}
            </Link>
          )}
          {event.is_peak_alert && (
            <span className="px-2 py-1 bg-alert/20 text-alert text-[10px] font-bold rounded-full">
              Peak day
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// StudySuggestionCard
// ─────────────────────────────────────────────

const MOOD_CONFIG: Record<SuggestionMood, {
  bg: string; border: string;
  Icon: LucideIcon; iconColor: string; iconBg: string;
}> = {
  neutral: {
    bg: "bg-surface",       border: "border-border",
    Icon: Lightbulb,  iconColor: "text-gold",       iconBg: "bg-gold-light",
  },
  warning: {
    bg: "bg-gold-light",    border: "border-gold/40",
    Icon: AlertTriangle, iconColor: "text-gold",    iconBg: "bg-gold/20",
  },
  danger: {
    bg: "bg-alert-light",   border: "border-alert/40",
    Icon: AlertCircle,  iconColor: "text-alert",    iconBg: "bg-alert/20",
  },
};

// ─────────────────────────────────────────────
// AISuggestionCard — real-time AI recommendation
// Keyed by date so it remounts (fresh chat) each time the selected date changes.
// ─────────────────────────────────────────────

function AISuggestionCard({
  dayEvents,
  allSpots,
}: {
  dayEvents: CalendarEvent[];
  allSpots: SuggestionSpot[];
}) {
  const { messages, sendMessage, status } = useChat();
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    const evSummary =
      dayEvents.length > 0
        ? dayEvents
            .map((e) => `${e.title}${e.is_peak_alert ? " [peak day]" : ""}`)
            .join(", ")
        : "No campus events today";
    sendMessage({
      text: `Campus events today: ${evSummary}.
Give a student-friendly recommendation in plain text point form.
Rules:
- Use symbols like ✅ ⚠️ 📍 💺 🔌.
- No markdown syntax at all (no **, no [link](...), no code style).
- Keep it short (max 90 words).
- Recommend top 2 best spots for today.
- For each spot include: name, seats left, power note, one-line why, and route path like /location/{id}.`,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLoading = status === "submitted" || status === "streaming";
  const lastMsg   = messages.filter((m) => m.role === "assistant").at(-1);
  const aiTextRaw = lastMsg?.parts.filter(isTextUIPart).map((p) => p.text).join("") ?? "";
  const aiText    = formatReadableAiText(aiTextRaw);

  const mood  = getEventMood(dayEvents);
  const c     = MOOD_CONFIG[mood];
  const spots = getQuickSpots(mood, allSpots);

  return (
    <div className={`rounded-2xl border p-4 ${c.bg} ${c.border}`}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${c.iconBg}`}>
          <c.Icon size={15} className={c.iconColor} strokeWidth={2.3} />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-widest leading-none">
            AI Study Suggestion
          </p>
          <p className="text-sm font-bold text-ink mt-1 leading-snug">Where to Study Today</p>
        </div>
      </div>

      {/* AI response or loading state */}
      {isLoading && !aiText ? (
        <div className="flex items-center gap-2 text-xs text-ink-muted mb-3">
          <Loader2 size={12} className="animate-spin shrink-0" />
          <span>AI is analysing today&apos;s schedule…</span>
        </div>
      ) : (
        <p className="text-xs text-ink-muted leading-relaxed mb-3 whitespace-pre-wrap">
          {aiText || "Analysing campus conditions…"}
        </p>
      )}

      {/* Quick-nav spot chips */}
      <div className="flex flex-wrap gap-2">
        {spots.map((spot) => (
          <Link
            key={spot.locationId}
            href={`/location/${spot.locationId}`}
            className="group flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-xl text-xs font-medium text-ink hover:border-brand hover:bg-brand-faint transition-all duration-150"
          >
            <MapPin size={10} className="text-brand-dark shrink-0" />
            <span>{spot.name}</span>
            <ChevronRight size={10} className="text-ink-faint group-hover:text-ink transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function EventsPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [events, setEvents]             = useState<CalendarEvent[]>([]);
  const [loading, setLoading]           = useState(true);
  const [eventsError, setEventsError]   = useState<string | null>(null);
  const [suggestionSpots, setSuggestionSpots] = useState<SuggestionSpot[]>([]);

  // Fetch events whenever the displayed month changes
  useEffect(() => {
    setLoading(true);
    setEventsError(null);

    const monthStart = startOfMonth(currentMonth);
    const monthParam = format(currentMonth, "yyyy-MM");
    let cancelled = false;

    fetch(`/api/events/calendar?month=${monthParam}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Failed to load events.");
        }
        return res.json() as Promise<{
          events: CalendarEvent[];
          spots: SuggestionSpot[];
        }>;
      })
      .then((payload) => {
        if (cancelled) return;

        const monthEvents = (payload.events ?? [])
          .filter((event) => {
            const date = parseISO(event.event_date);
            return date.getFullYear() === currentMonth.getFullYear() && date.getMonth() === currentMonth.getMonth();
          })
          .map((event) => ({ ...event, is_peak_alert: Boolean(event.is_peak_alert) }));

        setSuggestionSpots(payload.spots ?? []);
        setEvents(monthEvents);
        setSelectedDate((prev) => {
          const isPrevInMonth =
            prev.getFullYear() === currentMonth.getFullYear() &&
            prev.getMonth() === currentMonth.getMonth();
          const prevHasEvent =
            isPrevInMonth &&
            monthEvents.some((event) => isSameDay(parseISO(event.event_date), prev));

          if (prevHasEvent) return prev;
          if (monthEvents.length > 0) return parseISO(monthEvents[0].event_date);
          return monthStart;
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Could not load events right now.";
        console.error("[events] Failed to load events:", message);
        setEvents([]);
        setSuggestionSpots([]);
        setEventsError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentMonth]);

  // Dates that have events / peak alerts (for day modifiers)
  const eventDates = useMemo(
    () => events.filter((e) => !e.is_peak_alert).map((e) => parseISO(e.event_date)),
    [events]
  );
  const peakDates = useMemo(
    () => events.filter((e) => e.is_peak_alert).map((e) => parseISO(e.event_date)),
    [events]
  );

  const dayEvents = useMemo(() => getEventsForDate(selectedDate, events), [selectedDate, events]);

  return (
    <motion.div
      variants={pageEntry}
      initial="hidden"
      animate="show"
      className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto"
    >
      {/* ── Page header ── */}
      <motion.div variants={blockEntry} className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-ink leading-tight">
          Campus Events & Schedule
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Plan your study sessions around campus events, exam weeks, and peak hours.
        </p>
      </motion.div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5 md:gap-6 items-start">

        {/* ────────────────────────────────────────
            LEFT — Calendar card
        ──────────────────────────────────────── */}
        <motion.div variants={blockEntry}>
          <div className="bg-surface rounded-2xl border border-border shadow-sm p-5">
            {/* Section label */}
            <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-widest mb-3">
              Calendar
            </p>

            {/* DayPicker */}
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              classNames={CAL_CLASSES}
              components={{
                DayButton: CustomDayButton,
                Chevron: ({ orientation }) =>
                  orientation === "left"
                    ? <ChevronLeft size={15} />
                    : <ChevronRight size={15} />,
              }}
              modifiers={{
                hasEvent: eventDates,
                isPeak:   peakDates,
              }}
              modifiersClassNames={{
                hasEvent: "ring-1 ring-brand/40 ring-inset",
                isPeak:   "ring-1 ring-alert/50 ring-inset",
              }}
            />

            {/* Legend */}
            <div className="flex items-center gap-5 mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brand-dark shrink-0" />
                <span className="text-[11px] text-ink-muted">Event</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-alert shrink-0" />
                <span className="text-[11px] text-ink-muted">Peak / Exam day</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded bg-brand shrink-0" />
                <span className="text-[11px] text-ink-muted">Selected</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ────────────────────────────────────────
            RIGHT — Daily details
        ──────────────────────────────────────── */}
        <motion.div variants={blockEntry} className="space-y-4">
          {/* Selected date header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-widest leading-none">
                {format(selectedDate, "EEEE")}
              </p>
              <h2 className="text-xl font-bold text-ink leading-tight mt-1">
                {format(selectedDate, "d MMMM yyyy")}
              </h2>
            </div>
            {!loading && dayEvents.length > 0 && (
              <span className="px-3 py-1 bg-brand text-ink text-xs font-bold rounded-full shadow-sm">
                {dayEvents.length} event{dayEvents.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* AnimatePresence fades the detail panel on date change */}
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {[1, 2].map((i) => (
                  <div key={i} className="h-24 rounded-2xl bg-canvas animate-pulse" />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key={selectedDate.toDateString()}
                variants={fadeSlide}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-3"
              >
                {eventsError && (
                  <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl border border-alert/30 bg-alert-light">
                    <AlertCircle size={14} className="text-alert shrink-0 mt-0.5" />
                    <p className="text-xs text-ink-muted">{eventsError}</p>
                  </div>
                )}
                {dayEvents.length > 0 ? (
                  <>
                    {dayEvents.map((event) => {
                      const loc = event.location_id
                        ? suggestionSpots.find((s) => s.locationId === event.location_id)
                        : null;
                      return (
                        <EventCard
                          key={event.id}
                          event={event}
                          locationName={event.location_name ?? loc?.name ?? null}
                        />
                      );
                    })}
                  </>
                ) : (
                  /* Empty state */
                  <div className="flex flex-col items-center justify-center py-10 text-center bg-surface rounded-2xl border border-border">
                    <div className="w-12 h-12 rounded-2xl bg-brand-faint flex items-center justify-center mb-3">
                      <CalendarDays size={22} className="text-brand-dark" />
                    </div>
                    <p className="text-sm font-semibold text-ink">Nothing scheduled</p>
                    <p className="text-xs text-ink-muted mt-1 max-w-50">
                      No events on this day. A perfect window for uninterrupted studying!
                    </p>
                  </div>
                )}

                {/* AI-powered study suggestion — remounts fresh per date */}
                <AISuggestionCard
                  key={selectedDate.toDateString()}
                  dayEvents={dayEvents}
                  allSpots={suggestionSpots}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}
