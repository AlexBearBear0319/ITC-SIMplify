"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { Activity, MapPin, Clock, Users, Lightbulb, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type KPI = { label: string; value: string; sub: string; icon: LucideIcon; iconBg: string; iconClass: string };
type HourlyPoint  = { hour: string; density: number; count: number };
type CategorySlice = { name: string; value: number; color: string };

type StatsSnapshot = {
  checkinsToday:          number;
  busiestSpot:            string;
  busiestCapacityPct:     number;
  avgStudyMins:           number;
  activeGroups:           number;
  groupsOpen:             number;
  peakHours:              HourlyPoint[];
  categories:             CategorySlice[];
  weeklyTotal:            number;
};

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const CHART_COLORS = ["#B3D2D5", "#E5989B", "#E2C044", "#7BC99A", "#A78BFA", "#F97316"];

// Hours the library is open (9 AM – 9 PM)
const OPEN_HOURS = [9,10,11,12,13,14,15,16,17,18,19,20,21];

function hourLabel(h: number) {
  if (h === 12) return "12PM";
  return h < 12 ? `${h}AM` : `${h - 12}PM`;
}

// ─────────────────────────────────────────────
// Animation variants
// ─────────────────────────────────────────────

const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const cardVariants = {
  hidden:   { opacity: 0, y: 16 },
  visible:  { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

// ─────────────────────────────────────────────
// Custom tooltips
// ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-xl px-3 py-2 shadow-md">
      <p className="text-xs font-semibold text-ink">{label}</p>
      <p className="text-sm font-bold text-brand-dark">{payload[0].payload.count} check-ins</p>
      <p className="text-xs text-ink-faint">{payload[0].value}% relative density</p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-xl px-3 py-2 shadow-md">
      <p className="text-xs font-semibold text-ink">{payload[0].name}</p>
      <p className="text-sm font-bold text-ink-muted">{payload[0].value}%</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────

function KPICard({ kpi, loading }: { kpi: KPI; loading: boolean }) {
  const Icon = kpi.icon;
  return (
    <motion.div
      variants={cardVariants}
      className="bg-surface rounded-2xl p-5 border border-border shadow-sm flex items-start gap-4 hover:-translate-y-0.5 hover:shadow-md transition-[transform,box-shadow] duration-200"
    >
      <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${kpi.iconBg}`}>
        <Icon size={18} className={kpi.iconClass} />
      </div>
      <div className="min-w-0 flex-1">
        {loading ? (
          <>
            <div className="h-7 w-16 rounded-lg bg-border/50 animate-pulse mb-1" />
            <div className="h-3 w-24 rounded bg-border/40 animate-pulse" />
          </>
        ) : (
          <>
            <p className="text-2xl font-extrabold text-ink leading-none">{kpi.value}</p>
            <p className="text-xs font-medium text-ink-muted mt-1">{kpi.label}</p>
            <p className="text-[11px] text-ink-faint mt-0.5">{kpi.sub}</p>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function StatisticsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading,    setLoading]    = useState(true);
  const [stats,      setStats]      = useState<StatsSnapshot | null>(null);
  const [aiInsight,  setAiInsight]  = useState("");
  const [aiLoading,  setAiLoading]  = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Load live data from Supabase ──────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

      const [
        { count: checkinsToday },
        { data: activeSessions },
        { data: todaySessions },
        { data: groups },
        { data: hourlySessions },
        { data: catSessions },
      ] = await Promise.all([
        // 1. Today's total check-ins
        supabase
          .from("active_sessions")
          .select("id", { count: "exact", head: true })
          .gte("check_in_time", todayStart.toISOString()),

        // 2. Currently active sessions with location info (for busiest spot)
        supabase
          .from("active_sessions")
          .select("location_id, seats_taken, locations(name, total_seats)")
          .eq("is_active", true),

        // 3. Today's sessions for avg duration
        supabase
          .from("active_sessions")
          .select("duration_minutes")
          .gte("check_in_time", todayStart.toISOString()),

        // 4. Active study groups
        supabase
          .from("study_groups")
          .select("current_members, max_members")
          .eq("is_active", true),

        // 5. Today's sessions for hourly distribution
        supabase
          .from("active_sessions")
          .select("check_in_time")
          .gte("check_in_time", todayStart.toISOString())
          .not("check_in_time", "is", null),

        // 6. Last 7 days sessions for category breakdown
        supabase
          .from("active_sessions")
          .select("locations(category)")
          .gte("check_in_time", sevenDaysAgo.toISOString()),
      ]);

      // ── KPI: busiest spot ──
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const locMap: Record<number, { name: string; seats: number; total: number }> = {};
      for (const s of activeSessions ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const loc = (s as any).locations;
        const id = s.location_id as number;
        if (!locMap[id]) locMap[id] = { name: loc?.name ?? "Unknown", seats: 0, total: loc?.total_seats ?? 0 };
        locMap[id].seats += s.seats_taken ?? 1;
      }
      const sorted = Object.values(locMap).sort((a, b) => b.seats - a.seats);
      const busiest = sorted[0];
      const busiestCapacityPct = busiest && busiest.total > 0
        ? Math.round((busiest.seats / busiest.total) * 100)
        : 0;

      // ── KPI: avg study time ──
      const avgStudyMins = todaySessions?.length
        ? Math.round((todaySessions.reduce((s, r) => s + (r.duration_minutes ?? 0), 0)) / todaySessions.length)
        : 0;

      // ── KPI: groups ──
      const activeGroups = groups?.length ?? 0;
      const groupsOpen   = (groups ?? []).filter(g => g.current_members < g.max_members).length;

      // ── Hourly distribution ──
      const buckets: Record<number, number> = {};
      for (const s of hourlySessions ?? []) {
        const h = new Date(s.check_in_time!).getHours();
        buckets[h] = (buckets[h] ?? 0) + 1;
      }
      const maxCount = Math.max(1, ...Object.values(buckets));
      const peakHours: HourlyPoint[] = OPEN_HOURS.map((h) => ({
        hour:    hourLabel(h),
        count:   buckets[h] ?? 0,
        density: Math.round(((buckets[h] ?? 0) / maxCount) * 100),
      }));

      // ── Category breakdown ──
      const catMap: Record<string, number> = {};
      for (const s of catSessions ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cat = (s as any).locations?.category ?? "Other";
        catMap[cat] = (catMap[cat] ?? 0) + 1;
      }
      const weeklyTotal = Object.values(catMap).reduce((a, b) => a + b, 0);
      const categories: CategorySlice[] = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count], i) => ({
          name,
          value: weeklyTotal > 0 ? Math.round((count / weeklyTotal) * 100) : 0,
          color: CHART_COLORS[i % CHART_COLORS.length],
        }));

      const snapshot: StatsSnapshot = {
        checkinsToday:      checkinsToday ?? 0,
        busiestSpot:        busiest?.name ?? "—",
        busiestCapacityPct,
        avgStudyMins,
        activeGroups,
        groupsOpen,
        peakHours,
        categories,
        weeklyTotal,
      };

      setStats(snapshot);
      setLoading(false);
      generateInsight(snapshot);
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // ── AI-powered trend summary (uses /api/admin-insight) ──────────
  async function generateInsight(s: StatsSnapshot) {
    setAiLoading(true);
    setAiInsight("");

    const peakHour = s.peakHours.reduce(
      (max, h) => (h.density > max.density ? h : max),
      s.peakHours[0] ?? { hour: "—", density: 0, count: 0 }
    );
    const topCat = s.categories[0];

    const snapshot = {
      checkinsToday:      s.checkinsToday,
      busiestSpot:        s.busiestSpot,
      busiestCapacityPct: s.busiestCapacityPct,
      avgStudyMins:       s.avgStudyMins,
      activeGroups:       s.activeGroups,
      groupsOpen:         s.groupsOpen,
      peakHour:           peakHour.hour,
      peakCount:          peakHour.count,
      peakDensity:        peakHour.density,
      topCategory:        topCat?.name    ?? "—",
      topCategoryPct:     topCat?.value   ?? 0,
      weeklyTotal:        s.weeklyTotal,
    };

    try {
      const res = await fetch("/api/admin-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      });
      if (!res.body) return;
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAiInsight((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } finally {
      setAiLoading(false);
    }
  }

  // ── Build KPI array from live stats ───────────────────────────
  const kpiCards: KPI[] = stats ? [
    {
      label:     "Check-ins Today",
      value:     String(stats.checkinsToday),
      sub:       "Students who entered a study spot",
      icon:      Activity,
      iconBg:    "bg-brand-faint",
      iconClass: "text-brand-dark",
    },
    {
      label:     "Busiest Spot",
      value:     stats.busiestSpot,
      sub:       stats.busiestCapacityPct > 0 ? `${stats.busiestCapacityPct}% capacity right now` : "No active sessions",
      icon:      MapPin,
      iconBg:    "bg-alert-light",
      iconClass: "text-alert",
    },
    {
      label:     "Avg Study Time",
      value:     stats.avgStudyMins >= 60
        ? `${Math.floor(stats.avgStudyMins / 60)}h ${stats.avgStudyMins % 60}m`
        : `${stats.avgStudyMins}m`,
      sub:       "Per session today",
      icon:      Clock,
      iconBg:    "bg-gold-light",
      iconClass: "text-gold",
    },
    {
      label:     "Active Groups",
      value:     String(stats.activeGroups),
      sub:       stats.groupsOpen > 0 ? `${stats.groupsOpen} open to join` : "All groups are full",
      icon:      Users,
      iconBg:    "bg-success-light",
      iconClass: "text-success",
    },
  ] : [];

  const peakHours  = stats?.peakHours  ?? [];
  const categories = stats?.categories ?? [];
  const weeklyTotal = stats?.weeklyTotal ?? 0;

  return (
    <div className="min-h-full bg-canvas px-4 pt-6 pb-16 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-ink">Campus Insights</h1>
            <p className="text-sm text-ink-muted mt-1">
              Live analytics and AI-generated trend summaries for campus admins.
              Use this page to monitor demand, spot bottlenecks, and plan resources.
            </p>
          </div>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full border border-border text-ink-muted hover:text-ink hover:bg-canvas transition-colors disabled:opacity-40"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* ── KPI cards ── */}
        <div>
          <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-widest mb-3">
            Today at a Glance — refreshed on page load
          </p>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 lg:grid-cols-4 gap-3"
          >
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <motion.div
                    key={i}
                    variants={cardVariants}
                    className="bg-surface rounded-2xl p-5 border border-border shadow-sm h-24 animate-pulse"
                  />
                ))
              : kpiCards.map((kpi) => (
                  <KPICard key={kpi.label} kpi={kpi} loading={false} />
                ))}
          </motion.div>
        </div>

        {/* ── Charts row ── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-5 gap-4"
        >
          {/* Bar chart — Peak Hours */}
          <motion.div
            variants={cardVariants}
            className="lg:col-span-3 bg-surface rounded-2xl border border-border shadow-sm p-5"
          >
            <div className="mb-1">
              <h2 className="text-sm font-bold text-ink">Peak Hours (Campus-wide)</h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Check-in density by hour today — bars are relative to the busiest hour.
                Use this to know when to expect queues and when spaces free up.
              </p>
            </div>
            {loading ? (
              <div className="h-56 rounded-xl bg-border/30 animate-pulse mt-4" />
            ) : (
              <div className="h-56 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={peakHours} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E0" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#A8B8C8" }} axisLine={false} tickLine={false} interval={1} />
                    <YAxis tick={{ fontSize: 10, fill: "#A8B8C8" }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip content={<BarTooltip />} cursor={{ fill: "#EDF5F6", radius: 4 }} />
                    <Bar dataKey="density" fill="#B3D2D5" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {!loading && peakHours.every(h => h.count === 0) && (
              <p className="text-xs text-ink-faint text-center mt-2">No check-ins recorded yet today.</p>
            )}
          </motion.div>

          {/* Donut chart — Popular Categories */}
          <motion.div
            variants={cardVariants}
            className="lg:col-span-2 bg-surface rounded-2xl border border-border shadow-sm p-5"
          >
            <div className="mb-1">
              <h2 className="text-sm font-bold text-ink">Most Popular Categories</h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Where students study most — last 7 days.
                Helps identify which facility types need more capacity or promotion.
              </p>
            </div>

            {loading ? (
              <div className="h-44 rounded-xl bg-border/30 animate-pulse mt-4" />
            ) : categories.length === 0 ? (
              <div className="h-44 flex items-center justify-center mt-4">
                <p className="text-xs text-ink-faint">No data for the past 7 days.</p>
              </div>
            ) : (
              <>
                <div className="relative h-44 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categories}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={72}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                        isAnimationActive
                        animationDuration={800}
                        animationEasing="ease-out"
                      >
                        {categories.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<DonutTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-xl font-extrabold text-ink leading-none">{weeklyTotal}</p>
                      <p className="text-[10px] text-ink-muted mt-0.5">7-day total</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                  {categories.map((cat) => (
                    <div key={cat.name} className="flex items-center gap-1.5">
                      <span className="shrink-0 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-[11px] text-ink-muted truncate flex-1">{cat.name}</span>
                      <span className="text-[11px] font-semibold text-ink">{cat.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>

        {/* ── AI Trend Summary ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
          className="flex items-start gap-4 p-5 rounded-2xl bg-gold-light border border-gold/30 shadow-sm"
        >
          <div className="shrink-0 w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center">
            <Lightbulb size={18} className="text-gold fill-gold/20" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-bold text-ink">AI Trend Summary</p>
              {aiLoading && (
                <span className="text-[10px] text-ink-faint animate-pulse">Analysing data…</span>
              )}
            </div>
            <p className="text-[11px] text-ink-faint mb-2">
              GPT analyses today's live data and surfaces patterns, concerns, and one recommendation for admins.
              Regenerates automatically when you refresh the page.
            </p>
            {aiLoading && !aiInsight ? (
              <div className="space-y-1.5">
                <div className="h-3 rounded bg-gold/20 animate-pulse w-full" />
                <div className="h-3 rounded bg-gold/20 animate-pulse w-4/5" />
                <div className="h-3 rounded bg-gold/20 animate-pulse w-2/3" />
              </div>
            ) : (
              <p className="text-sm text-ink-muted leading-relaxed">
                {aiInsight || "Waiting for data…"}
                {aiLoading && <span className="inline-block w-1 h-3.5 bg-gold/60 ml-0.5 animate-pulse rounded-sm" />}
              </p>
            )}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
