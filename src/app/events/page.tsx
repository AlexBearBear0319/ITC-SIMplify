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

import { useState, useMemo, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import type { DayButtonProps } from "react-day-picker";
import { format, isSameDay, parseISO, startOfMonth, endOfMonth } from "date-fns";
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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// ─────────────────────────────────────────────
// Types  (matches events table schema exactly)
// ─────────────────────────────────────────────

type CalendarEvent = {
  id: number;
  title: string;
  description: string;
  event_date: string;      // ISO 8601 string
  location_id: number | null;
  is_peak_alert: boolean;
};

type SuggestionMood = "neutral" | "warning" | "danger";

type StudySuggestion = {
  heading: string;
  tip: string;
  spots: { name: string; highlight: string; locationId: number }[];
  mood: SuggestionMood;
};

// ─────────────────────────────────────────────
// Location ID → name mapping
// ─────────────────────────────────────────────

const LOCATIONS_MAP: Record<number, string> = {
  1: "Main IT Lab",
  2: "Library Level 3",
  3: "Study Corner A",
  4: "Canteen Terrace",
  5: "PC Lab 2",
  6: "Reading Room",
};

// Quiet-to-active tiers for smart suggestions
const SUGGESTION_SPOTS: StudySuggestion["spots"] = [
  { name: "Library Level 3",  highlight: "Quietest spot on campus",       locationId: 2 },
  { name: "Reading Room",     highlight: "Minimal foot traffic",           locationId: 6 },
  { name: "Study Corner A",   highlight: "Comfortable, uncrowded seating", locationId: 3 },
  { name: "PC Lab 2",         highlight: "Computers + great WiFi",         locationId: 5 },
  { name: "Main IT Lab",      highlight: "Best for coding sessions",       locationId: 1 },
];

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

function getSuggestion(events: CalendarEvent[]): StudySuggestion {
  const hasExam     = events.some((e) => /exam/i.test(e.title));
  const hasNoisy    = events.some((e) => /fair|orientation|expo|welcome/i.test(e.title));
  const hasPeak     = events.some((e) => e.is_peak_alert);
  const hasWorkshop = events.some((e) => /workshop|bootcamp|talk/i.test(e.title));

  if (hasExam)
    return {
      heading: "Exam period — campus will be packed",
      tip:     "Library spots fill up fast. Arrive before 8 AM for a guaranteed seat. Keep noise levels down.",
      spots:   SUGGESTION_SPOTS.slice(0, 2),
      mood:    "danger",
    };

  if (hasNoisy)
    return {
      heading: "High-traffic event on campus today",
      tip:     "Main areas and corridors will be crowded. Head to upper-floor spots for a quieter environment.",
      spots:   SUGGESTION_SPOTS.slice(1, 3),
      mood:    "warning",
    };

  if (hasPeak)
    return {
      heading: "Busier than usual today",
      tip:     "Expect above-average footfall. Grab a spot early and consider packing lunch to avoid long queues.",
      spots:   SUGGESTION_SPOTS.slice(0, 3),
      mood:    "warning",
    };

  if (hasWorkshop)
    return {
      heading: "Workshop day — IT Labs may be occupied",
      tip:     "One or more labs are running events. Quiet study spots on other floors remain fully available.",
      spots:   [SUGGESTION_SPOTS[0], SUGGESTION_SPOTS[1], SUGGESTION_SPOTS[3]],
      mood:    "neutral",
    };

  if (events.length === 0)
    return {
      heading: "Clear day — full campus available",
      tip:     "No major events today. Most spots should be quiet and easy to find.",
      spots:   SUGGESTION_SPOTS.slice(0, 3),
      mood:    "neutral",
    };

  return {
    heading: "Light schedule — great day to study",
    tip:     "Campus is running its normal routine. Good conditions for a long, focused session.",
    spots:   SUGGESTION_SPOTS.slice(0, 3),
    mood:    "neutral",
  };
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
  nav:             "flex items-center gap-0.5",
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

function EventCard({ event }: { event: CalendarEvent }) {
  const { Icon, bg, border, iconBg, iconColor } = getEventStyle(event);
  const locationName = event.location_id ? LOCATIONS_MAP[event.location_id] : null;
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
            <span className="px-1.5 py-0.5 bg-alert/20 text-alert text-[10px] font-bold rounded-full">
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

function StudySuggestionCard({ suggestion }: { suggestion: StudySuggestion }) {
  const c = MOOD_CONFIG[suggestion.mood];

  return (
    <div className={`rounded-2xl border p-4 ${c.bg} ${c.border}`}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${c.iconBg}`}>
          <c.Icon size={15} className={c.iconColor} strokeWidth={2.3} />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-widest leading-none">
            Where to Study Today
          </p>
          <p className="text-sm font-bold text-ink mt-0.5 leading-snug">{suggestion.heading}</p>
        </div>
      </div>

      <p className="text-xs text-ink-muted leading-relaxed mb-3">{suggestion.tip}</p>

      {/* Spot chips */}
      <div className="flex flex-wrap gap-2">
        {suggestion.spots.map((spot) => (
          <Link
            key={spot.locationId}
            href={`/location/${spot.locationId}`}
            className="group flex items-center gap-1.5 px-2.5 py-1.5 bg-surface border border-border rounded-xl text-xs font-medium text-ink hover:border-brand hover:bg-brand-faint transition-all duration-150"
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

  // Fetch events whenever the displayed month changes
  useEffect(() => {
    const supabase = createClient();
    setLoading(true);
    supabase
      .from("events")
      .select("id, title, description, event_date, location_id, is_peak_alert")
      .gte("event_date", startOfMonth(currentMonth).toISOString())
      .lte("event_date", endOfMonth(currentMonth).toISOString())
      .order("event_date")
      .then(({ data }) => {
        setEvents((data ?? []) as CalendarEvent[]);
        setLoading(false);
      });
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

  const dayEvents  = useMemo(() => getEventsForDate(selectedDate, events), [selectedDate, events]);
  const suggestion = useMemo(() => getSuggestion(dayEvents), [dayEvents]);

  return (
    <motion.div
      variants={pageEntry}
      initial="hidden"
      animate="show"
      className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto"
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
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand-dark shrink-0" />
                <span className="text-[11px] text-ink-muted">Event</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-alert shrink-0" />
                <span className="text-[11px] text-ink-muted">Peak / Exam day</span>
              </div>
              <div className="flex items-center gap-1.5">
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
              <h2 className="text-xl font-bold text-ink leading-tight mt-0.5">
                {format(selectedDate, "d MMMM yyyy")}
              </h2>
            </div>
            {!loading && dayEvents.length > 0 && (
              <span className="px-2.5 py-1 bg-brand text-ink text-xs font-bold rounded-full shadow-sm">
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
                {dayEvents.length > 0 ? (
                  <>
                    {dayEvents.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
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

                {/* Smart suggestion — always shown when a date is selected */}
                <StudySuggestionCard suggestion={suggestion} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}
