"use client";

/**
 * Campus Insights — /statistics
 *
 * Requires: npm install recharts  (already installed)
 *
 * Supabase wiring:
 *   Replace MOCK_PEAK_HOURS with:
 *     const { data } = await supabase
 *       .rpc("get_hourly_checkin_density", { date: new Date().toISOString().split("T")[0] });
 *
 *   Replace MOCK_CATEGORIES with:
 *     const { data } = await supabase
 *       .rpc("get_category_breakdown", { days: 7 });
 *
 *   Replace MOCK_KPI with:
 *     const { data } = await supabase
 *       .rpc("get_campus_kpi_today");
 */

import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Activity, MapPin, Clock, Users, Lightbulb } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type KPI = {
  label: string;
  value: string;
  sub: string;
  icon: LucideIcon;
  iconBg: string;
  iconClass: string;
};

type HourlyPoint = { hour: string; density: number };
type CategorySlice = { name: string; value: number; color: string };

// ─────────────────────────────────────────────
// Mock data  ← swap with Supabase RPCs
// ─────────────────────────────────────────────

// TODO: Replace with supabase.rpc("get_campus_kpi_today")
const MOCK_KPI: KPI[] = [
  { label: "Check-ins Today",  value: "142",    sub: "+18% vs yesterday",    icon: Activity, iconBg: "bg-brand-faint",   iconClass: "text-brand-dark" },
  { label: "Busiest Spot",     value: "IT Lab",  sub: "92% capacity right now", icon: MapPin,   iconBg: "bg-alert-light",   iconClass: "text-alert"      },
  { label: "Avg Study Time",   value: "1h 45m",  sub: "per session today",    icon: Clock,    iconBg: "bg-gold-light",    iconClass: "text-gold"       },
  { label: "Active Groups",    value: "7",       sub: "3 looking for members", icon: Users,    iconBg: "bg-success-light", iconClass: "text-success"    },
];

// TODO: Replace with supabase.rpc("get_hourly_checkin_density", { date: today })
const MOCK_PEAK_HOURS: HourlyPoint[] = [
  { hour: "8AM",  density: 15 },
  { hour: "9AM",  density: 38 },
  { hour: "10AM", density: 62 },
  { hour: "11AM", density: 80 },
  { hour: "12PM", density: 92 },
  { hour: "1PM",  density: 75 },
  { hour: "2PM",  density: 95 },
  { hour: "3PM",  density: 86 },
  { hour: "4PM",  density: 70 },
  { hour: "5PM",  density: 52 },
  { hour: "6PM",  density: 38 },
  { hour: "7PM",  density: 22 },
  { hour: "8PM",  density: 10 },
];

// TODO: Replace with supabase.rpc("get_category_breakdown", { days: 7 })
const MOCK_CATEGORIES: CategorySlice[] = [
  { name: "IT Labs",      value: 45, color: "#B3D2D5" },
  { name: "Libraries",   value: 30, color: "#E5989B" },
  { name: "Cafeterias",  value: 15, color: "#E2C044" },
  { name: "Study Rooms", value: 10, color: "#7BC99A" },
];

// Mock weekly total — swap with aggregate from the RPC above
const MOCK_WEEKLY_TOTAL = 337;

// ─────────────────────────────────────────────
// Animation variants
// ─────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden:  { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

// ─────────────────────────────────────────────
// Custom recharts tooltips
// ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-xl px-3 py-2 shadow-md">
      <p className="text-xs font-semibold text-ink">{label}</p>
      <p className="text-sm font-bold text-brand-dark">{payload[0].value}% density</p>
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

function KPICard({ kpi }: { kpi: KPI }) {
  const Icon = kpi.icon;
  return (
    <motion.div
      variants={cardVariants}
      className="bg-surface rounded-2xl p-5 border border-border shadow-sm flex items-start gap-4 hover:-translate-y-0.5 hover:shadow-md transition-[transform,box-shadow] duration-200"
    >
      <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${kpi.iconBg}`}>
        <Icon size={18} className={kpi.iconClass} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold text-ink leading-none">{kpi.value}</p>
        <p className="text-xs font-medium text-ink-muted mt-1">{kpi.label}</p>
        <p className="text-[11px] text-ink-faint mt-0.5">{kpi.sub}</p>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function StatisticsPage() {
  return (
    <div className="min-h-full bg-canvas px-4 pt-6 pb-16 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Campus Insights</h1>
          <p className="text-sm text-ink-muted mt-1">
            AI-powered crowd trends and study spot analytics.
          </p>
        </div>

        {/* ── KPI cards ── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        >
          {MOCK_KPI.map((kpi) => (
            <KPICard key={kpi.label} kpi={kpi} />
          ))}
        </motion.div>

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
            <div className="mb-4">
              <h2 className="text-sm font-bold text-ink">Peak Hours (Campus-wide)</h2>
              <p className="text-xs text-ink-muted mt-0.5">Crowd density % by time of day</p>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={MOCK_PEAK_HOURS}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  barSize={14}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#E4E4E0"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 10, fill: "#A8B8C8" }}
                    axisLine={false}
                    tickLine={false}
                    interval={1}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#A8B8C8" }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <Tooltip
                    content={<BarTooltip />}
                    cursor={{ fill: "#EDF5F6", radius: 4 }}
                  />
                  <Bar
                    dataKey="density"
                    fill="#B3D2D5"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive
                    animationDuration={800}
                    animationEasing="ease-out"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Donut chart — Popular Categories */}
          <motion.div
            variants={cardVariants}
            className="lg:col-span-2 bg-surface rounded-2xl border border-border shadow-sm p-5"
          >
            <div className="mb-4">
              <h2 className="text-sm font-bold text-ink">Most Popular Categories</h2>
              <p className="text-xs text-ink-muted mt-0.5">Check-in breakdown · last 7 days</p>
            </div>

            {/* Donut with overlay center label */}
            <div className="relative h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={MOCK_CATEGORIES}
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
                    {MOCK_CATEGORIES.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Center label — overlaid with CSS */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-xl font-extrabold text-ink leading-none">
                    {MOCK_WEEKLY_TOTAL}
                  </p>
                  <p className="text-[10px] text-ink-muted mt-0.5">7-day total</p>
                </div>
              </div>
            </div>

            {/* Custom legend */}
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              {MOCK_CATEGORIES.map((cat) => (
                <div key={cat.name} className="flex items-center gap-1.5">
                  <span
                    className="shrink-0 w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-[11px] text-ink-muted truncate flex-1">
                    {cat.name}
                  </span>
                  <span className="text-[11px] font-semibold text-ink">
                    {cat.value}%
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* ── AI Suggestion Panel ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.4,
            delay: 0.3,
            ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
          }}
          className="flex items-start gap-4 p-5 rounded-2xl bg-gold-light border border-gold/30 shadow-sm"
        >
          <div className="shrink-0 w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center">
            <Lightbulb size={18} className="text-gold fill-gold/20" />
          </div>
          <div>
            <p className="text-sm font-bold text-ink">AI Trend Alert</p>
            <p className="text-sm text-ink-muted mt-0.5 leading-relaxed">
              Libraries reach{" "}
              <span className="font-semibold text-ink">90% capacity by 2 PM on Tuesdays</span>.
              Consider heading to{" "}
              <span className="font-semibold text-ink">Study Corner A</span> or{" "}
              <span className="font-semibold text-ink">PC Lab 2</span> for a
              quieter session. Plan accordingly!
            </p>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
