"use client";

import { useState, useEffect, useRef, createContext, useContext, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { createClient } from "@/utils/supabase/client";
import {
  adminSaveEvent, adminDeleteEvent,
  adminSaveReward, adminDeleteReward, adminToggleReward, adminAdjustStock,
  adminToggleAdmin, adminUpdatePoints,
  adminSaveLocation, adminDeleteLocation, adminUpdateLocationStatus,
  adminDeleteReview,
  adminUpdateRule, adminToggleRule,
  adminSaveSchool, adminDeleteSchool,
  adminSaveMajor, adminDeleteMajor,
  adminSaveSubject, adminDeleteSubject,
} from "@/app/admin/actions";
import { getLevelEmoji } from "@/lib/levels";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  Activity, MapPin, Users, Lightbulb, CalendarDays, Gift, Star,
  Plus, Pencil, Trash2, X, Coins, Shield, BarChart2, MessageSquare,
  Minus, AlertTriangle, ChevronRight, GraduationCap, BookOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Shared form styles ──────────────────────────────────────────────────────

const INPUT = [
  "w-full px-3 py-2.5 rounded-xl border border-border bg-canvas text-ink text-sm",
  "placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/40",
  "transition-colors resize-none",
].join(" ");
const LABEL    = "block text-xs font-semibold text-ink-muted mb-1.5";
const BTN_PRI  = "flex items-center gap-1.5 px-4 py-2 bg-ink text-surface text-sm font-medium rounded-full hover:bg-ink/80 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_GHOST = "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-border text-ink-muted hover:text-ink hover:bg-canvas transition-colors";

// ── Error context ────────────────────────────────────────────────────────────

const AdminErrorCtx = createContext<(msg: string | null) => void>(() => {});
function useAdminError() { return useContext(AdminErrorCtx); }

// ── Tab config ──────────────────────────────────────────────────────────────

type Tab = "overview" | "events" | "rewards" | "users" | "locations" | "reviews" | "rules" | "schools";

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "overview",   label: "Overview",     icon: BarChart2      },
  { id: "events",     label: "Events",       icon: CalendarDays   },
  { id: "rewards",    label: "Rewards",      icon: Gift           },
  { id: "users",      label: "Users",        icon: Users          },
  { id: "locations",  label: "Locations",    icon: MapPin         },
  { id: "reviews",    label: "Reviews",      icon: MessageSquare  },
  { id: "rules",      label: "Point Rules",  icon: Coins          },
  { id: "schools",    label: "Schools",      icon: GraduationCap  },
];

// ── Domain types ────────────────────────────────────────────────────────────

type AEvent = {
  id: number; title: string; description: string | null;
  event_date: string; location_id: number | null; is_peak_alert: boolean | null;
  locations?: { name: string } | null;
};

type AReward = {
  id: number; name: string; description: string | null;
  cost: number; stock: number | null; is_active: boolean | null; image_url: string | null;
};

type AUser = {
  id: string; username: string | null; full_name: string | null;
  points: number | null; is_admin: boolean | null;
};

type ALocation = {
  id: number; name: string; category: string | null; current_status: string | null;
  total_seats: number | null; power_outlets: number | null;
  location_text: string | null; description: string | null; opening_time: string | null;
  qr_token: string | null; coordinates_x: number | null; coordinates_y: number | null;
};

type AReview = {
  id: number; rating: number | null; comment: string | null; created_at: string | null;
  profiles: { username: string | null; full_name: string | null } | null;
  locations: { name: string } | null;
};

type ARule = {
  id: number; action_name: string;
  points_awarded: number | null; cooldown_minutes: number | null; is_active: boolean | null;
};

type SSchool  = { id: number; name: string; abbr: string };
type SMajor   = { id: number; school_id: number; name: string; education_level: string | null };
type SSubject = { id: number; major_id: number; name: string; course_code: string | null };

const EDU_LEVELS = ["Diploma", "Undergraduate", "Postgraduate"] as const;
type EduLevel = typeof EDU_LEVELS[number];

// ── Shared UI components ────────────────────────────────────────────────────

function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay/50 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 bg-surface rounded-2xl shadow-xl outline-none max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <Dialog.Title className="text-sm font-bold text-ink">{title}</Dialog.Title>
            <Dialog.Close className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-canvas transition-colors">
              <X size={15} />
            </Dialog.Close>
          </div>
          <div className="p-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DeleteBtn({ id, confirmId, setConfirmId, onDelete }: {
  id: number | string;
  confirmId: number | string | null;
  setConfirmId: (v: number | string | null) => void;
  onDelete: (id: number | string) => void;
}) {
  if (confirmId === id) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => { onDelete(id); setConfirmId(null); }}
          className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-alert text-surface hover:bg-alert/80 transition-colors"
        >
          Confirm
        </button>
        <button
          onClick={() => setConfirmId(null)}
          className="px-2.5 py-1 text-[10px] font-medium rounded-lg border border-border text-ink-muted hover:text-ink transition-colors"
        >
          No
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={() => setConfirmId(id)}
      className="p-1.5 rounded-lg text-ink-faint hover:text-alert hover:bg-alert-light transition-colors"
      title="Delete"
    >
      <Trash2 size={13} />
    </button>
  );
}

function MiniToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none ${on ? "bg-brand-dark" : "bg-border"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-surface shadow-sm transition-transform duration-200 ${on ? "translate-x-4" : "translate-x-0"}`}
      />
    </button>
  );
}

function Stars({ n }: { n: number | null }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={11} className={i <= (n ?? 0) ? "text-gold fill-gold" : "text-border"} />
      ))}
    </div>
  );
}

function SectionHeader({ title, sub, onAdd }: { title: string; sub: string; onAdd?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h2 className="text-base font-bold text-ink">{title}</h2>
        <p className="text-xs text-ink-muted mt-0.5">{sub}</p>
      </div>
      {onAdd && (
        <button onClick={onAdd} className={BTN_PRI}>
          <Plus size={14} /> Add New
        </button>
      )}
    </div>
  );
}

function DataTable({ heads, children, emptyColSpan }: {
  heads: string[]; children: React.ReactNode; emptyColSpan?: number;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b border-border">
            {heads.map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-ink-faint whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function TR({ children, alt }: { children: React.ReactNode; alt?: boolean }) {
  return <tr className={`border-b border-border last:border-0 ${alt ? "bg-canvas/40" : ""}`}>{children}</tr>;
}

function TD({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm text-ink ${className}`}>{children}</td>;
}

function SkeletonRows({ n = 4 }: { n?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-surface border border-border animate-pulse" />
      ))}
    </div>
  );
}

// ── Mock chart data (wire to RPCs when DB functions are ready) ──────────────

const PEAK_HOURS = [
  { hour: "8AM", d: 15 }, { hour: "9AM", d: 38 }, { hour: "10AM", d: 62 },
  { hour: "11AM", d: 80 }, { hour: "12PM", d: 92 }, { hour: "1PM", d: 75 },
  { hour: "2PM", d: 95 }, { hour: "3PM", d: 86 }, { hour: "4PM", d: 70 },
  { hour: "5PM", d: 52 }, { hour: "6PM", d: 38 }, { hour: "7PM", d: 22 },
  { hour: "8PM", d: 10 },
];

const CAT_SLICES = [
  { name: "IT Labs",      value: 45, color: "#B3D2D5" },
  { name: "Libraries",    value: 30, color: "#E5989B" },
  { name: "Cafeterias",   value: 15, color: "#E2C044" },
  { name: "Study Rooms",  value: 10, color: "#7BC99A" },
];

// ── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab() {
  const supabase = createClient();
  const [kpi, setKpi] = useState({ users: 0, checkins: 0, groups: 0, redemptions: 0 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("active_sessions")
        .select("id", { count: "exact", head: true })
        .gte("check_in_time", today.toISOString()),
      supabase.from("study_groups")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      supabase.from("user_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]).then(([u, c, g, r]) => {
      setKpi({ users: u.count ?? 0, checkins: c.count ?? 0, groups: g.count ?? 0, redemptions: r.count ?? 0 });
      setReady(true);
    });
  }, []);

  const cards = [
    { label: "Registered Users",       value: kpi.users,       sub: "total accounts",            icon: Users,     bg: "bg-brand-faint",   cls: "text-brand-dark" },
    { label: "Check-ins Today",        value: kpi.checkins,    sub: "since midnight",             icon: Activity,  bg: "bg-success-light", cls: "text-success"    },
    { label: "Active Study Groups",    value: kpi.groups,      sub: "currently running",          icon: Users,     bg: "bg-gold-light",    cls: "text-gold"       },
    { label: "Pending Redemptions",    value: kpi.redemptions, sub: "awaiting claim",             icon: Gift,      bg: "bg-alert-light",   cls: "text-alert"      },
  ];

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(({ label, value, sub, icon: Icon, bg, cls }) => (
          <div key={label} className="bg-surface rounded-2xl p-4 border border-border shadow-sm">
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon size={16} className={cls} />
            </div>
            <p className="text-2xl font-extrabold text-ink leading-none">
              {ready ? value.toLocaleString() : <span className="opacity-40">—</span>}
            </p>
            <p className="text-xs font-medium text-ink-muted mt-1">{label}</p>
            <p className="text-[11px] text-ink-faint mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Peak hours bar */}
        <div className="lg:col-span-3 bg-surface rounded-2xl border border-border shadow-sm p-5">
          <h3 className="text-sm font-bold text-ink mb-0.5">Peak Hours (Campus-wide)</h3>
          <p className="text-xs text-ink-muted mb-4">Crowd density % by time of day · indicative</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={PEAK_HOURS} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barSize={12}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E0" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#A8B8C8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#A8B8C8" }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  content={({ active, payload, label }: any) =>
                    active && payload?.length ? (
                      <div className="bg-surface border border-border rounded-xl px-3 py-2 shadow-md">
                        <p className="text-xs font-semibold text-ink">{label}</p>
                        <p className="text-sm font-bold text-brand-dark">{payload[0].value}% density</p>
                      </div>
                    ) : null
                  }
                  cursor={{ fill: "#EDF5F6", radius: 4 }}
                />
                <Bar dataKey="d" fill="#B3D2D5" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={600} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category donut */}
        <div className="lg:col-span-2 bg-surface rounded-2xl border border-border shadow-sm p-5">
          <h3 className="text-sm font-bold text-ink mb-0.5">Popular Categories</h3>
          <p className="text-xs text-ink-muted mb-4">Check-in breakdown · last 7 days</p>
          <div className="relative h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={CAT_SLICES} cx="50%" cy="50%" innerRadius={46} outerRadius={66} paddingAngle={3} dataKey="value" strokeWidth={0} isAnimationActive animationDuration={600}>
                  {CAT_SLICES.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  content={({ active, payload }: any) =>
                    active && payload?.length ? (
                      <div className="bg-surface border border-border rounded-xl px-3 py-2 shadow-md">
                        <p className="text-xs font-semibold text-ink">{payload[0].name}</p>
                        <p className="text-sm font-bold text-ink-muted">{payload[0].value}%</p>
                      </div>
                    ) : null
                  }
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-xl font-extrabold text-ink leading-none">337</p>
                <p className="text-[10px] text-ink-muted mt-0.5">7-day total</p>
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {CAT_SLICES.map((c) => (
              <div key={c.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <span className="text-[11px] text-ink-muted truncate flex-1">{c.name}</span>
                <span className="text-[11px] font-semibold text-ink">{c.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI tip */}
      <div className="flex items-start gap-4 p-5 rounded-2xl bg-gold-light border border-gold/30 shadow-sm">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center">
          <Lightbulb size={18} className="text-gold fill-gold/20" />
        </div>
        <div>
          <p className="text-sm font-bold text-ink">AI Trend Alert</p>
          <p className="text-sm text-ink-muted mt-0.5 leading-relaxed">
            Libraries reach <span className="font-semibold text-ink">90% capacity by 2 PM on Tuesdays</span>.
            Consider redirecting students to <span className="font-semibold text-ink">Study Corner A</span> or{" "}
            <span className="font-semibold text-ink">PC Lab 2</span> during peak hours.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Events Tab ──────────────────────────────────────────────────────────────

type EventForm = {
  title: string; description: string; event_date: string;
  location_id: string; is_peak_alert: boolean;
};
const EMPTY_EVENT: EventForm = {
  title: "", description: "", event_date: "", location_id: "", is_peak_alert: false,
};

function EventsTab() {
  const setErr = useAdminError();
  const supabase = createClient();
  const [events,    setEvents]    = useState<AEvent[]>([]);
  const [locs,      setLocs]      = useState<{ id: number; name: string }[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [open,      setOpen]      = useState(false);
  const [editing,   setEditing]   = useState<AEvent | null>(null);
  const [form,      setForm]      = useState<EventForm>(EMPTY_EVENT);
  const [saving,    setSaving]    = useState(false);
  const [confirmId, setConfirmId] = useState<number | string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("events")
      .select("*, locations(name)")
      .order("event_date", { ascending: true });
    if (data) setEvents(data as AEvent[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    supabase.from("locations").select("id, name").order("name")
      .then(({ data }) => { if (data) setLocs(data); });
  }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY_EVENT); setOpen(true); };
  const openEdit   = (e: AEvent) => {
    setEditing(e);
    setForm({
      title:         e.title,
      description:   e.description   ?? "",
      event_date:    e.event_date.slice(0, 16),
      location_id:   e.location_id   != null ? String(e.location_id) : "",
      is_peak_alert: e.is_peak_alert ?? false,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.event_date) return;
    setSaving(true);
    const payload = {
      title:         form.title.trim(),
      description:   form.description.trim() || null,
      event_date:    form.event_date,
      location_id:   form.location_id ? Number(form.location_id) : null,
      is_peak_alert: form.is_peak_alert,
    };
    const res = await adminSaveEvent(payload, editing?.id);
    if (res.error) { setErr(res.error); setSaving(false); return; }
    await load();
    setOpen(false);
    setSaving(false);
  };

  const handleDelete = async (id: number | string) => {
    const res = await adminDeleteEvent(id as number);
    if (res.error) { setErr(res.error); return; }
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const set = <K extends keyof EventForm>(k: K, v: EventForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <SectionHeader title="Events" sub="Campus events shown on the calendar" onAdd={openCreate} />

      {loading ? <SkeletonRows /> : (
        <DataTable heads={["Title", "Date & Time", "Location", "Peak Alert", ""]}>
          {events.map((e, i) => (
            <TR key={e.id} alt={i % 2 === 1}>
              <TD className="font-medium max-w-52 truncate">{e.title}</TD>
              <TD className="whitespace-nowrap text-ink-muted text-xs">
                {new Date(e.event_date).toLocaleString("en-SG", {
                  day: "numeric", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </TD>
              <TD className="text-ink-muted text-xs">{e.locations?.name ?? "—"}</TD>
              <TD>
                {e.is_peak_alert ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-alert-light text-alert text-[10px] font-semibold">
                    <AlertTriangle size={9} /> Peak
                  </span>
                ) : (
                  <span className="text-ink-faint text-xs">—</span>
                )}
              </TD>
              <TD className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg text-ink-faint hover:text-brand-dark hover:bg-brand-faint transition-colors">
                    <Pencil size={13} />
                  </button>
                  <DeleteBtn id={e.id} confirmId={confirmId} setConfirmId={setConfirmId} onDelete={handleDelete} />
                </div>
              </TD>
            </TR>
          ))}
          {events.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-muted">No events yet.</td></tr>
          )}
        </DataTable>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Event" : "New Event"}>
        <div className="space-y-4">
          <div>
            <label className={LABEL}>Title *</label>
            <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)} className={INPUT} placeholder="Event title" />
          </div>
          <div>
            <label className={LABEL}>Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} className={INPUT} placeholder="Optional details…" />
          </div>
          <div>
            <label className={LABEL}>Date & Time *</label>
            <input type="datetime-local" value={form.event_date} onChange={(e) => set("event_date", e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Location</label>
            <select value={form.location_id} onChange={(e) => set("location_id", e.target.value)} className={INPUT}>
              <option value="">No location</option>
              {locs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox" checked={form.is_peak_alert}
              onChange={(e) => set("is_peak_alert", e.target.checked)}
              className="w-4 h-4 rounded border-border accent-brand"
            />
            <span className="text-sm text-ink">Mark as Peak Alert</span>
            <span className="text-xs text-ink-faint">(shows crowd warning on nearby spots)</span>
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setOpen(false)} className={BTN_GHOST}>Cancel</button>
            <button onClick={handleSave} disabled={!form.title.trim() || !form.event_date || saving} className={BTN_PRI}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Create Event"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ── Rewards Tab ─────────────────────────────────────────────────────────────

type RewardForm = {
  name: string; description: string; cost: string;
  stock: string; image_url: string; is_active: boolean;
};
const EMPTY_REWARD: RewardForm = {
  name: "", description: "", cost: "", stock: "", image_url: "", is_active: true,
};

function RewardsTab() {
  const setErr = useAdminError();
  const supabase = createClient();
  const [items,     setItems]     = useState<AReward[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [open,      setOpen]      = useState(false);
  const [editing,   setEditing]   = useState<AReward | null>(null);
  const [form,      setForm]      = useState<RewardForm>(EMPTY_REWARD);
  const [saving,    setSaving]    = useState(false);
  const [confirmId, setConfirmId] = useState<number | string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("redemption_items").select("*").order("name");
    if (data) setItems(data as AReward[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY_REWARD); setOpen(true); };
  const openEdit   = (r: AReward) => {
    setEditing(r);
    setForm({
      name: r.name, description: r.description ?? "",
      cost: String(r.cost), stock: r.stock != null ? String(r.stock) : "",
      image_url: r.image_url ?? "", is_active: r.is_active ?? true,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.cost) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(), description: form.description.trim() || null,
      cost: Number(form.cost), stock: form.stock ? Number(form.stock) : null,
      image_url: form.image_url.trim() || null, is_active: form.is_active,
    };
    const res = await adminSaveReward(payload, editing?.id);
    if (res.error) { setErr(res.error); setSaving(false); return; }
    await load();
    setOpen(false);
    setSaving(false);
  };

  const handleDelete = async (id: number | string) => {
    const res = await adminDeleteReward(id as number);
    if (res.error) { setErr(res.error); return; }
    setItems((prev) => prev.filter((r) => r.id !== id));
  };

  const toggleActive = async (r: AReward) => {
    const next = !r.is_active;
    const res = await adminToggleReward(r.id, next);
    if (res.error) { setErr(res.error); return; }
    setItems((prev) => prev.map((x) => x.id === r.id ? { ...x, is_active: next } : x));
  };

  const adjustStock = async (r: AReward, delta: number) => {
    const next = Math.max(0, (r.stock ?? 0) + delta);
    const res = await adminAdjustStock(r.id, next);
    if (res.error) { setErr(res.error); return; }
    setItems((prev) => prev.map((x) => x.id === r.id ? { ...x, stock: next } : x));
  };

  const set = <K extends keyof RewardForm>(k: K, v: RewardForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <SectionHeader title="Rewards" sub="Items students can redeem with points" onAdd={openCreate} />

      {loading ? <SkeletonRows /> : (
        <DataTable heads={["Item", "Cost (pts)", "Stock", "Active", ""]}>
          {items.map((r, i) => (
            <TR key={r.id} alt={i % 2 === 1}>
              <TD>
                <p className="font-medium text-ink">{r.name}</p>
                {r.description && <p className="text-xs text-ink-faint line-clamp-1">{r.description}</p>}
              </TD>
              <TD>
                <span className="flex items-center gap-1 font-bold text-gold">
                  <Coins size={12} /> {r.cost.toLocaleString()}
                </span>
              </TD>
              <TD>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => adjustStock(r, -1)}
                    className="w-6 h-6 rounded-full border border-border flex items-center justify-center text-ink-muted hover:bg-canvas transition-colors"
                  >
                    <Minus size={10} />
                  </button>
                  <span className="text-sm font-semibold text-ink w-8 text-center">
                    {r.stock ?? "∞"}
                  </span>
                  <button
                    onClick={() => adjustStock(r, 1)}
                    className="w-6 h-6 rounded-full border border-border flex items-center justify-center text-ink-muted hover:bg-canvas transition-colors"
                  >
                    <Plus size={10} />
                  </button>
                </div>
              </TD>
              <TD>
                <div className="flex items-center gap-2">
                  <MiniToggle on={r.is_active ?? false} onToggle={() => toggleActive(r)} />
                  <span className={`text-xs font-medium ${r.is_active ? "text-success" : "text-ink-faint"}`}>
                    {r.is_active ? "Active" : "Off"}
                  </span>
                </div>
              </TD>
              <TD className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-ink-faint hover:text-brand-dark hover:bg-brand-faint transition-colors">
                    <Pencil size={13} />
                  </button>
                  <DeleteBtn id={r.id} confirmId={confirmId} setConfirmId={setConfirmId} onDelete={handleDelete} />
                </div>
              </TD>
            </TR>
          ))}
          {items.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-muted">No rewards yet.</td></tr>
          )}
        </DataTable>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Reward" : "New Reward"}>
        <div className="space-y-4">
          <div>
            <label className={LABEL}>Name *</label>
            <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} className={INPUT} placeholder="e.g., SIM Merchandise Voucher" />
          </div>
          <div>
            <label className={LABEL}>Description</label>
            <textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} className={INPUT} placeholder="What does this reward include?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Cost (pts) *</label>
              <input type="number" min={0} value={form.cost} onChange={(e) => set("cost", e.target.value)} className={INPUT} placeholder="500" />
            </div>
            <div>
              <label className={LABEL}>Stock (blank = unlimited)</label>
              <input type="number" min={0} value={form.stock} onChange={(e) => set("stock", e.target.value)} className={INPUT} placeholder="∞" />
            </div>
          </div>
          <div>
            <label className={LABEL}>Image URL</label>
            <input type="text" value={form.image_url} onChange={(e) => set("image_url", e.target.value)} className={INPUT} placeholder="https://…" />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox" checked={form.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
              className="w-4 h-4 rounded border-border accent-brand"
            />
            <span className="text-sm text-ink">Active (visible to students)</span>
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setOpen(false)} className={BTN_GHOST}>Cancel</button>
            <button onClick={handleSave} disabled={!form.name.trim() || !form.cost || saving} className={BTN_PRI}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Create Reward"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ── Users Tab ───────────────────────────────────────────────────────────────

function UsersTab() {
  const setErr = useAdminError();
  const supabase = createClient();
  const [users,      setUsers]      = useState<AUser[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [editingPts, setEditingPts] = useState<AUser | null>(null);
  const [ptsVal,     setPtsVal]     = useState("");
  const [savingPts,  setSavingPts]  = useState(false);

  useEffect(() => {
    supabase.from("profiles")
      .select("id, username, full_name, points, is_admin")
      .order("points", { ascending: false })
      .then(({ data }) => { if (data) setUsers(data as AUser[]); setLoading(false); });
  }, []);

  const toggleAdmin = async (u: AUser) => {
    const next = !u.is_admin;
    const res = await adminToggleAdmin(u.id, next);
    if (res.error) { setErr(res.error); return; }
    setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, is_admin: next } : x));
  };

  const handleSetPoints = async () => {
    if (!editingPts || ptsVal === "") return;
    setSavingPts(true);
    const pts = Math.max(0, Number(ptsVal));
    const res = await adminUpdatePoints(editingPts.id, pts);
    if (res.error) { setErr(res.error); setSavingPts(false); return; }
    setUsers((prev) => prev.map((x) => x.id === editingPts.id ? { ...x, points: pts } : x));
    setEditingPts(null);
    setSavingPts(false);
  };

  const filtered = search
    ? users.filter((u) => {
        const q = search.toLowerCase();
        return (u.username ?? "").toLowerCase().includes(q) ||
               (u.full_name ?? "").toLowerCase().includes(q);
      })
    : users;

  return (
    <>
      <SectionHeader title="Users" sub={`${users.length} registered accounts`} />

      <div className="relative mb-4">
        <input
          type="text" value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or username…"
          className={INPUT}
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink">
            <X size={13} />
          </button>
        )}
      </div>

      {loading ? <SkeletonRows n={6} /> : (
        <DataTable heads={["User", "Points", "Level", "Admin", ""]}>
          {filtered.map((u, i) => (
            <TR key={u.id} alt={i % 2 === 1}>
              <TD>
                <p className="font-medium text-ink leading-tight">{u.full_name ?? "—"}</p>
                <p className="text-xs text-ink-faint">@{u.username ?? "—"}</p>
              </TD>
              <TD>
                <span className="flex items-center gap-1 font-bold text-gold">
                  <Coins size={12} /> {(u.points ?? 0).toLocaleString()}
                </span>
              </TD>
              <TD className="text-lg">{getLevelEmoji(u.points ?? 0)}</TD>
              <TD>
                <button
                  onClick={() => toggleAdmin(u)}
                  className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                    u.is_admin
                      ? "bg-brand-faint border-brand/30 text-brand-dark"
                      : "bg-canvas border-border text-ink-faint hover:border-brand/30 hover:text-brand-dark"
                  }`}
                >
                  <Shield size={11} />
                  {u.is_admin ? "Admin" : "User"}
                </button>
              </TD>
              <TD className="text-right">
                <button
                  onClick={() => { setEditingPts(u); setPtsVal(String(u.points ?? 0)); }}
                  className="p-1.5 rounded-lg text-ink-faint hover:text-brand-dark hover:bg-brand-faint transition-colors"
                  title="Edit points"
                >
                  <Pencil size={13} />
                </button>
              </TD>
            </TR>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-muted">No users found.</td></tr>
          )}
        </DataTable>
      )}

      <Modal
        open={!!editingPts}
        onClose={() => setEditingPts(null)}
        title={`Edit Points — @${editingPts?.username ?? editingPts?.full_name}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            Current balance: <span className="font-bold text-gold">{(editingPts?.points ?? 0).toLocaleString()} pts</span>
          </p>
          <div>
            <label className={LABEL}>Set New Points Total</label>
            <input
              type="number" min={0} value={ptsVal}
              onChange={(e) => setPtsVal(e.target.value)}
              className={INPUT}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditingPts(null)} className={BTN_GHOST}>Cancel</button>
            <button onClick={handleSetPoints} disabled={savingPts} className={BTN_PRI}>
              {savingPts ? "Saving…" : "Update Points"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ── Locations Tab ────────────────────────────────────────────────────────────

const LOC_CATEGORIES = ["IT Lab", "Library", "Cafeteria", "Study Room", "Lecture Hall", "Outdoor", "Other"];
const LOC_STATUSES   = ["empty", "busy", "full"];

type LocForm = {
  name: string; category: string; location_text: string; description: string;
  total_seats: string; power_outlets: string; opening_time: string;
  coordinates_x: string; coordinates_y: string;
};
const EMPTY_LOC: LocForm = {
  name: "", category: "", location_text: "", description: "",
  total_seats: "", power_outlets: "", opening_time: "",
  coordinates_x: "", coordinates_y: "",
};

// Clickable floor-plan mini-map for setting coordinates_x / coordinates_y
function MapPinSelector({
  x, y, onChange,
}: {
  x: number; y: number;
  onChange: (x: number, y: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const px = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const py = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    onChange(Math.max(0, Math.min(100, px)), Math.max(0, Math.min(100, py)));
  };
  const hasPin = x > 0 || y > 0;
  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label="Click map to set pin location"
      className="relative w-full h-28 bg-brand-faint/30 rounded-xl overflow-hidden cursor-crosshair border border-dashed border-brand/40 select-none"
    >
      {/* Simplified floor-plan silhouette */}
      <svg viewBox="0 0 600 400" className="absolute inset-0 w-full h-full opacity-20" aria-hidden="true">
        <rect x="12"  y="12"  width="180" height="136" rx="4" fill="#B3D2D5" />
        <rect x="204" y="12"  width="180" height="136" rx="4" fill="#B3D2D5" />
        <rect x="396" y="12"  width="192" height="148" rx="4" fill="#B3D2D5" />
        <rect x="12"  y="164" width="576" height="108" rx="4" fill="#B3D2D5" />
        <rect x="12"  y="280" width="216" height="108" rx="4" fill="#B3D2D5" />
        <rect x="234" y="280" width="108" height="108" rx="4" fill="#B3D2D5" />
        <rect x="348" y="280" width="240" height="108" rx="4" fill="#B3D2D5" />
      </svg>
      {hasPin ? (
        <div
          className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-alert border-2 border-surface shadow-sm pointer-events-none"
          style={{ left: `${x}%`, top: `${y}%` }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-xs text-ink-faint">Click map to pin location</p>
        </div>
      )}
    </div>
  );
}

function LocationsTab() {
  const setErr = useAdminError();
  const supabase = createClient();
  const [locs,      setLocs]      = useState<ALocation[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [open,      setOpen]      = useState(false);
  const [editing,   setEditing]   = useState<ALocation | null>(null);
  const [form,      setForm]      = useState<LocForm>(EMPTY_LOC);
  const [saving,    setSaving]    = useState(false);
  const [confirmId, setConfirmId] = useState<number | string | null>(null);
  const [currentQrToken, setCurrentQrToken] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("locations")
      .select("id, name, category, current_status, total_seats, power_outlets, location_text, description, opening_time, qr_token, coordinates_x, coordinates_y")
      .order("name");
    if (data) setLocs(data as ALocation[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_LOC);
    setCurrentQrToken(crypto.randomUUID());
    setOpen(true);
  };
  const openEdit   = (l: ALocation) => {
    setEditing(l);
    setCurrentQrToken(l.qr_token ?? crypto.randomUUID());
    setForm({
      name:          l.name,
      category:      l.category      ?? "",
      location_text: l.location_text ?? "",
      description:   l.description   ?? "",
      total_seats:   l.total_seats   != null ? String(l.total_seats)   : "",
      power_outlets: l.power_outlets != null ? String(l.power_outlets) : "",
      opening_time:  l.opening_time  ?? "",
      coordinates_x: l.coordinates_x != null ? String(l.coordinates_x) : "",
      coordinates_y: l.coordinates_y != null ? String(l.coordinates_y) : "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      name:          form.name.trim(),
      category:      form.category      || null,
      location_text: form.location_text.trim() || null,
      description:   form.description.trim()   || null,
      total_seats:   form.total_seats   ? Number(form.total_seats)   : null,
      power_outlets: form.power_outlets ? Number(form.power_outlets) : null,
      opening_time:  form.opening_time.trim()  || null,
      coordinates_x: form.coordinates_x ? Number(form.coordinates_x) : null,
      coordinates_y: form.coordinates_y ? Number(form.coordinates_y) : null,
    };
    if (!editing) payload.qr_token = currentQrToken;
    const res = await adminSaveLocation(payload, editing?.id);
    if (res.error) { setErr(res.error); setSaving(false); return; }
    await load();
    setOpen(false);
    setSaving(false);
  };

  const handleDelete = async (id: number | string) => {
    const res = await adminDeleteLocation(id as number);
    if (res.error) { setErr(res.error); return; }
    setLocs((prev) => prev.filter((l) => l.id !== id));
  };

  const updateStatus = async (l: ALocation, status: string) => {
    const res = await adminUpdateLocationStatus(l.id, status);
    if (res.error) { setErr(res.error); return; }
    setLocs((prev) => prev.map((x) => x.id === l.id ? { ...x, current_status: status } : x));
  };

  const set = (k: keyof LocForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const STATUS_COLOR: Record<string, string> = {
    empty: "text-success", busy: "text-gold", full: "text-alert",
  };

  return (
    <>
      <SectionHeader title="Locations" sub="Study spots and campus areas" onAdd={openCreate} />

      {loading ? <SkeletonRows /> : (
        <DataTable heads={["Name", "Category", "Status", "Seats", "Outlets", ""]}>
          {locs.map((l, i) => (
            <TR key={l.id} alt={i % 2 === 1}>
              <TD className="font-medium max-w-44 truncate">{l.name}</TD>
              <TD className="text-ink-muted text-xs">{l.category ?? "—"}</TD>
              <TD>
                <select
                  value={l.current_status ?? ""}
                  onChange={(e) => updateStatus(l, e.target.value)}
                  className={`text-xs border border-border rounded-lg px-2 py-1 bg-canvas cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand/40 ${STATUS_COLOR[l.current_status ?? ""] ?? "text-ink-faint"}`}
                >
                  <option value="">—</option>
                  {LOC_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </TD>
              <TD className="text-ink-muted">{l.total_seats ?? "—"}</TD>
              <TD className="text-ink-muted">{l.power_outlets ?? "—"}</TD>
              <TD className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => openEdit(l)} className="p-1.5 rounded-lg text-ink-faint hover:text-brand-dark hover:bg-brand-faint transition-colors">
                    <Pencil size={13} />
                  </button>
                  <DeleteBtn id={l.id} confirmId={confirmId} setConfirmId={setConfirmId} onDelete={handleDelete} />
                </div>
              </TD>
            </TR>
          ))}
          {locs.length === 0 && (
            <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-muted">No locations yet.</td></tr>
          )}
        </DataTable>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Location" : "New Location"}>
        <div className="space-y-4">
          <div>
            <label className={LABEL}>Name *</label>
            <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} className={INPUT} placeholder="e.g., IT Lab 1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Category</label>
              <select value={form.category} onChange={(e) => set("category", e.target.value)} className={INPUT}>
                <option value="">Select…</option>
                {LOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Opening Hours</label>
              <input type="text" value={form.opening_time} onChange={(e) => set("opening_time", e.target.value)} className={INPUT} placeholder="Mon–Fri 8am–9pm" />
            </div>
          </div>
          <div>
            <label className={LABEL}>Floor / Block</label>
            <input type="text" value={form.location_text} onChange={(e) => set("location_text", e.target.value)} className={INPUT} placeholder="e.g., Block A, Level 2" />
          </div>
          <div>
            <label className={LABEL}>Map Pin — click to place</label>
            <MapPinSelector
              x={form.coordinates_x ? Number(form.coordinates_x) : 0}
              y={form.coordinates_y ? Number(form.coordinates_y) : 0}
              onChange={(x, y) => { set("coordinates_x", String(x)); set("coordinates_y", String(y)); }}
            />
            {(form.coordinates_x || form.coordinates_y) && (
              <p className="text-[10px] text-ink-faint mt-1">x: {form.coordinates_x}% · y: {form.coordinates_y}%</p>
            )}
          </div>
          {currentQrToken && (
            <div>
              <label className={LABEL}>QR Code</label>
              <div className="flex items-start gap-4 p-3 bg-canvas rounded-xl border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(currentQrToken)}&margin=2`}
                  alt="Location QR Code"
                  className="w-24 h-24 rounded-xl border border-border shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Print and place this QR at the location. Students scan it to check in.
                  </p>
                  <p className="text-[10px] font-mono text-ink-faint mt-2 break-all">{currentQrToken}</p>
                  <a
                    href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(currentQrToken)}&margin=4`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-brand-dark hover:underline mt-1 inline-block"
                  >
                    Download full size ↗
                  </a>
                </div>
              </div>
            </div>
          )}
          <div>
            <label className={LABEL}>Description</label>
            <textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} className={INPUT} placeholder="About this space…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Total Seats</label>
              <input type="number" min={0} value={form.total_seats} onChange={(e) => set("total_seats", e.target.value)} className={INPUT} placeholder="0" />
            </div>
            <div>
              <label className={LABEL}>Power Outlets</label>
              <input type="number" min={0} value={form.power_outlets} onChange={(e) => set("power_outlets", e.target.value)} className={INPUT} placeholder="0" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setOpen(false)} className={BTN_GHOST}>Cancel</button>
            <button onClick={handleSave} disabled={!form.name.trim() || saving} className={BTN_PRI}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Create Location"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ── Reviews Tab ──────────────────────────────────────────────────────────────

function ReviewsTab() {
  const setErr = useAdminError();
  const supabase = createClient();
  const [reviews,   setReviews]   = useState<AReview[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [confirmId, setConfirmId] = useState<number | string | null>(null);
  const [locFilter, setLocFilter] = useState("all");
  const [locs,      setLocs]      = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    supabase
      .from("reviews")
      .select("id, rating, comment, created_at, profiles(username, full_name), locations(name)")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => { if (data) setReviews(data as unknown as AReview[]); setLoading(false); });
    supabase.from("locations").select("id, name").order("name")
      .then(({ data }) => { if (data) setLocs(data); });
  }, []);

  const handleDelete = async (id: number | string) => {
    const res = await adminDeleteReview(id as number);
    if (res.error) { setErr(res.error); return; }
    setReviews((prev) => prev.filter((r) => r.id !== id));
  };

  const selectedLocName = locs.find((l) => l.id === Number(locFilter))?.name;
  const filtered = locFilter === "all"
    ? reviews
    : reviews.filter((r) => r.locations?.name === selectedLocName);

  const avg = filtered.length
    ? (filtered.reduce((s, r) => s + (r.rating ?? 0), 0) / filtered.length).toFixed(1)
    : "—";

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base font-bold text-ink">Reviews</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            {filtered.length} review{filtered.length !== 1 ? "s" : ""}
            {locFilter !== "all" && ` · avg ${avg} ★`}
          </p>
        </div>
        <select
          value={locFilter}
          onChange={(e) => setLocFilter(e.target.value)}
          className="text-sm border border-border rounded-xl px-3 py-2 bg-surface text-ink cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/40"
        >
          <option value="all">All Locations</option>
          {locs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {loading ? <SkeletonRows /> : (
        <DataTable heads={["User", "Location", "Rating", "Comment", "Date", ""]}>
          {filtered.map((r, i) => (
            <TR key={r.id} alt={i % 2 === 1}>
              <TD>
                <p className="font-medium text-ink text-sm leading-tight">{r.profiles?.full_name ?? "—"}</p>
                <p className="text-xs text-ink-faint">@{r.profiles?.username ?? "—"}</p>
              </TD>
              <TD className="text-ink-muted text-xs max-w-32 truncate">{r.locations?.name ?? "—"}</TD>
              <TD><Stars n={r.rating} /></TD>
              <TD className="max-w-56 text-xs text-ink-muted">
                {r.comment
                  ? <span className="line-clamp-2">{r.comment}</span>
                  : <span className="italic text-ink-faint">No comment</span>
                }
              </TD>
              <TD className="text-ink-faint text-xs whitespace-nowrap">
                {r.created_at
                  ? new Date(r.created_at).toLocaleDateString("en-SG", { day: "numeric", month: "short" })
                  : "—"}
              </TD>
              <TD className="text-right">
                <DeleteBtn id={r.id} confirmId={confirmId} setConfirmId={setConfirmId} onDelete={handleDelete} />
              </TD>
            </TR>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-muted">No reviews found.</td></tr>
          )}
        </DataTable>
      )}
    </>
  );
}

// ── Point Rules Tab ──────────────────────────────────────────────────────────

function PointRulesTab() {
  const setErr = useAdminError();
  const supabase = createClient();
  const [rules,   setRules]   = useState<ARule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ARule | null>(null);
  const [form,    setForm]    = useState({ pts: "", cooldown: "" });
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    supabase.from("point_rules").select("*").order("action_name")
      .then(({ data }) => { if (data) setRules(data as ARule[]); setLoading(false); });
  }, []);

  const openEdit = (r: ARule) => {
    setEditing(r);
    setForm({
      pts:      r.points_awarded   != null ? String(r.points_awarded)   : "",
      cooldown: r.cooldown_minutes != null ? String(r.cooldown_minutes) : "",
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const payload = {
      points_awarded:   form.pts      ? Number(form.pts)      : null,
      cooldown_minutes: form.cooldown ? Number(form.cooldown) : null,
    };
    const res = await adminUpdateRule(editing.id, payload);
    if (res.error) { setErr(res.error); setSaving(false); return; }
    setRules((prev) => prev.map((x) => x.id === editing.id ? { ...x, ...payload } : x));
    setEditing(null);
    setSaving(false);
  };

  const toggleActive = async (r: ARule) => {
    const next = !r.is_active;
    const res = await adminToggleRule(r.id, next);
    if (res.error) { setErr(res.error); return; }
    setRules((prev) => prev.map((x) => x.id === r.id ? { ...x, is_active: next } : x));
  };

  return (
    <>
      <SectionHeader title="Point Rules" sub="Points awarded and cooldowns per action" />
      <p className="text-xs text-ink-faint mb-4">
        Changes take effect immediately — the app reads these values on every action.
      </p>

      {loading ? <SkeletonRows /> : (
        <DataTable heads={["Action", "Points Awarded", "Cooldown (min)", "Active", ""]}>
          {rules.map((r, i) => (
            <TR key={r.id} alt={i % 2 === 1}>
              <TD>
                <code className="text-xs px-1.5 py-0.5 rounded-md bg-canvas border border-border text-ink-muted font-mono">
                  {r.action_name}
                </code>
              </TD>
              <TD>
                <span className="flex items-center gap-1 font-bold text-gold">
                  <Coins size={12} /> {r.points_awarded ?? "—"}
                </span>
              </TD>
              <TD className="text-ink-muted">{r.cooldown_minutes ?? "—"} min</TD>
              <TD>
                <div className="flex items-center gap-2">
                  <MiniToggle on={r.is_active ?? false} onToggle={() => toggleActive(r)} />
                  <span className={`text-xs font-medium ${r.is_active ? "text-success" : "text-ink-faint"}`}>
                    {r.is_active ? "Active" : "Off"}
                  </span>
                </div>
              </TD>
              <TD className="text-right">
                <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-ink-faint hover:text-brand-dark hover:bg-brand-faint transition-colors">
                  <Pencil size={13} />
                </button>
              </TD>
            </TR>
          ))}
        </DataTable>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit Rule — ${editing?.action_name}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Points Awarded</label>
              <input
                type="number" min={0} value={form.pts}
                onChange={(e) => setForm((f) => ({ ...f, pts: e.target.value }))}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>Cooldown (minutes)</label>
              <input
                type="number" min={0} value={form.cooldown}
                onChange={(e) => setForm((f) => ({ ...f, cooldown: e.target.value }))}
                className={INPUT}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setEditing(null)} className={BTN_GHOST}>Cancel</button>
            <button onClick={handleSave} disabled={saving} className={BTN_PRI}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ── Schools Tab ─────────────────────────────────────────────────────────────

type SchoolForm   = { name: string; abbr: string };
type MajorForm    = { name: string; education_level: EduLevel };
type SubjectForm  = { name: string; course_code: string };

const EMPTY_SCHOOL:  SchoolForm  = { name: "", abbr: "" };
const EMPTY_MAJOR:   MajorForm   = { name: "", education_level: "Undergraduate" };
const EMPTY_SUBJECT: SubjectForm = { name: "", course_code: "" };

function SmallDeleteBtn({ onAsk, onConfirm, onCancel, asking }: {
  onAsk: () => void; onConfirm: () => void; onCancel: () => void; asking: boolean;
}) {
  if (asking) {
    return (
      <div className="flex items-center gap-1">
        <button onClick={onConfirm} className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-alert text-surface hover:bg-alert/80">
          Confirm
        </button>
        <button onClick={onCancel} className="px-2 py-0.5 text-[10px] font-medium rounded-lg border border-border text-ink-muted hover:text-ink">
          No
        </button>
      </div>
    );
  }
  return (
    <button onClick={onAsk} className="p-1 rounded-lg text-ink-faint hover:text-alert hover:bg-alert-light transition-colors">
      <Trash2 size={12} />
    </button>
  );
}

function SchoolsTab() {
  const setErr = useAdminError();
  const supabase = createClient();

  const [schools,  setSchools]  = useState<SSchool[]>([]);
  const [majors,   setMajors]   = useState<SMajor[]>([]);
  const [subjects, setSubjects] = useState<SSubject[]>([]);
  const [loading,  setLoading]  = useState(true);

  // Expand/collapse
  const [openSchools, setOpenSchools] = useState<Set<number>>(new Set());
  const [openMajors,  setOpenMajors]  = useState<Set<number>>(new Set());

  // Modal state
  type SchoolModal  = { open: boolean; editing: SSchool | null };
  type MajorModal   = { open: boolean; editing: SMajor | null; schoolId: number; level: EduLevel };
  type SubjectModal = { open: boolean; editing: SSubject | null; majorId: number };

  const [schoolModal,  setSchoolModal]  = useState<SchoolModal>({ open: false, editing: null });
  const [majorModal,   setMajorModal]   = useState<MajorModal>({ open: false, editing: null, schoolId: 0, level: "Undergraduate" });
  const [subjectModal, setSubjectModal] = useState<SubjectModal>({ open: false, editing: null, majorId: 0 });

  const [schoolForm,  setSchoolForm]  = useState<SchoolForm>(EMPTY_SCHOOL);
  const [majorForm,   setMajorForm]   = useState<MajorForm>(EMPTY_MAJOR);
  const [subjectForm, setSubjectForm] = useState<SubjectForm>(EMPTY_SUBJECT);
  const [saving,      setSaving]      = useState(false);

  // Inline delete confirm  (type + id pair)
  const [delConfirm, setDelConfirm] = useState<{ t: "school" | "major" | "subject"; id: number } | null>(null);

  const load = async () => {
    const [s, m, sub] = await Promise.all([
      supabase.from("schools").select("id, name, abbr").order("name"),
      supabase.from("majors").select("id, school_id, name, education_level").order("education_level").order("name"),
      supabase.from("subjects").select("id, major_id, name, course_code").order("name"),
    ]);
    if (s.data)   setSchools(s.data as SSchool[]);
    if (m.data)   setMajors(m.data as SMajor[]);
    if (sub.data) setSubjects(sub.data as SSubject[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── School CRUD ──
  const openCreateSchool = () => { setSchoolForm(EMPTY_SCHOOL); setSchoolModal({ open: true, editing: null }); };
  const openEditSchool   = (s: SSchool) => {
    setSchoolForm({ name: s.name, abbr: s.abbr });
    setSchoolModal({ open: true, editing: s });
  };
  const saveSchool = async () => {
    if (!schoolForm.name.trim() || !schoolForm.abbr.trim()) return;
    setSaving(true);
    const payload = { name: schoolForm.name.trim(), abbr: schoolForm.abbr.trim().toUpperCase() };
    const res = await adminSaveSchool(payload, schoolModal.editing?.id);
    if (res.error) { setErr(res.error); setSaving(false); return; }
    await load();
    setSchoolModal({ open: false, editing: null });
    setSaving(false);
  };
  const deleteSchool = async (id: number) => {
    const res = await adminDeleteSchool(id);
    if (res.error) { setErr(res.error); return; }
    setSchools((prev) => prev.filter((x) => x.id !== id));
    setMajors((prev) => prev.filter((x) => x.school_id !== id));
  };

  // ── Major CRUD ──
  const openCreateMajor = (schoolId: number, level: EduLevel) => {
    setMajorForm({ ...EMPTY_MAJOR, education_level: level });
    setMajorModal({ open: true, editing: null, schoolId, level });
  };
  const openEditMajor = (m: SMajor) => {
    setMajorForm({ name: m.name, education_level: (m.education_level as EduLevel) ?? "Undergraduate" });
    setMajorModal({ open: true, editing: m, schoolId: m.school_id, level: (m.education_level as EduLevel) ?? "Undergraduate" });
  };
  const saveMajor = async () => {
    if (!majorForm.name.trim()) return;
    setSaving(true);
    const payload = {
      name: majorForm.name.trim(),
      education_level: majorForm.education_level,
      school_id: majorModal.schoolId,
    };
    const res = await adminSaveMajor(payload, majorModal.editing?.id);
    if (res.error) { setErr(res.error); setSaving(false); return; }
    await load();
    setMajorModal((p) => ({ ...p, open: false }));
    setSaving(false);
  };
  const deleteMajor = async (id: number) => {
    const res = await adminDeleteMajor(id);
    if (res.error) { setErr(res.error); return; }
    setMajors((prev) => prev.filter((x) => x.id !== id));
    setSubjects((prev) => prev.filter((x) => x.major_id !== id));
  };

  // ── Subject CRUD ──
  const openCreateSubject = (majorId: number) => {
    setSubjectForm(EMPTY_SUBJECT);
    setSubjectModal({ open: true, editing: null, majorId });
  };
  const openEditSubject = (s: SSubject) => {
    setSubjectForm({ name: s.name, course_code: s.course_code ?? "" });
    setSubjectModal({ open: true, editing: s, majorId: s.major_id });
  };
  const saveSubject = async () => {
    if (!subjectForm.name.trim()) return;
    setSaving(true);
    const payload = {
      name:        subjectForm.name.trim(),
      course_code: subjectForm.course_code.trim().toUpperCase() || null,
      major_id:    subjectModal.majorId,
    };
    const res = await adminSaveSubject(payload, subjectModal.editing?.id);
    if (res.error) { setErr(res.error); setSaving(false); return; }
    await load();
    setSubjectModal((p) => ({ ...p, open: false }));
    setSaving(false);
  };
  const deleteSubject = async (id: number) => {
    const res = await adminDeleteSubject(id);
    if (res.error) { setErr(res.error); return; }
    setSubjects((prev) => prev.filter((x) => x.id !== id));
  };

  const toggleSchool = (id: number) =>
    setOpenSchools((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleMajor = (id: number) =>
    setOpenMajors((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const isDelConfirm = (t: "school" | "major" | "subject", id: number) =>
    delConfirm?.t === t && delConfirm.id === id;

  const EDU_BADGE: Record<EduLevel, string> = {
    Diploma:       "bg-success-light text-success",
    Undergraduate: "bg-brand-faint text-brand-dark",
    Postgraduate:  "bg-gold-light text-gold",
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <SectionHeader title="Schools & Curriculum" sub="…" />
        {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-surface border border-border animate-pulse" />)}
      </div>
    );
  }

  return (
    <>
      <SectionHeader
        title="Schools & Curriculum"
        sub="Manage schools, education levels, majors, and subjects with course codes"
        onAdd={openCreateSchool}
      />

      <div className="space-y-3">
        {schools.map((school) => {
          const schoolMajors = majors.filter((m) => m.school_id === school.id);
          const isOpen = openSchools.has(school.id);

          return (
            <div key={school.id} className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">

              {/* ── School row ── */}
              <div
                className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-canvas/40 transition-colors"
                onClick={() => toggleSchool(school.id)}
              >
                <ChevronRight
                  size={15}
                  className={`text-ink-faint shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                />
                <span className="font-bold text-ink flex-1 leading-tight">{school.name}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-faint text-brand-dark shrink-0">
                  {school.abbr}
                </span>
                <span className="text-xs text-ink-faint shrink-0">
                  {schoolMajors.length} major{schoolMajors.length !== 1 ? "s" : ""}
                </span>

                {/* Actions — stop propagation so click doesn't toggle */}
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => openEditSchool(school)}
                    className="p-1 rounded-lg text-ink-faint hover:text-brand-dark hover:bg-brand-faint transition-colors"
                  >
                    <Pencil size={12} />
                  </button>
                  <SmallDeleteBtn
                    asking={isDelConfirm("school", school.id)}
                    onAsk={() => setDelConfirm({ t: "school", id: school.id })}
                    onConfirm={() => { deleteSchool(school.id); setDelConfirm(null); }}
                    onCancel={() => setDelConfirm(null)}
                  />
                </div>
              </div>

              {/* ── Education levels (expanded) ── */}
              {isOpen && (
                <div className="border-t border-border">
                  {EDU_LEVELS.map((level) => {
                    const levelMajors = schoolMajors.filter((m) => m.education_level === level);

                    return (
                      <div key={level} className="border-b border-border/60 last:border-0">

                        {/* Level header */}
                        <div className="flex items-center justify-between px-5 py-2.5 bg-canvas/30">
                          <div className="flex items-center gap-2">
                            <GraduationCap size={13} className="text-ink-faint" />
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${EDU_BADGE[level]}`}>
                              {level}
                            </span>
                            <span className="text-xs text-ink-faint">
                              {levelMajors.length} major{levelMajors.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <button
                            onClick={() => openCreateMajor(school.id, level)}
                            className="flex items-center gap-1 text-[10px] font-semibold text-brand-dark hover:text-ink transition-colors px-2 py-1 rounded-lg hover:bg-brand-faint"
                          >
                            <Plus size={10} /> Add Major
                          </button>
                        </div>

                        {/* Majors */}
                        <div className="px-5 py-1">
                          {levelMajors.length === 0 ? (
                            <p className="text-xs text-ink-faint italic py-2">No majors added yet.</p>
                          ) : (
                            levelMajors.map((major) => {
                              const majorSubs = subjects.filter((s) => s.major_id === major.id);
                              const isMajorOpen = openMajors.has(major.id);

                              return (
                                <div key={major.id} className="border-b border-border/40 last:border-0">

                                  {/* Major row */}
                                  <div
                                    className="flex items-center gap-2 py-2.5 cursor-pointer"
                                    onClick={() => toggleMajor(major.id)}
                                  >
                                    <ChevronRight
                                      size={12}
                                      className={`text-ink-faint shrink-0 transition-transform duration-200 ${isMajorOpen ? "rotate-90" : ""}`}
                                    />
                                    <span className="text-sm font-semibold text-ink flex-1">
                                      {major.name}
                                    </span>
                                    <span className="text-xs text-ink-faint shrink-0">
                                      {majorSubs.length} subject{majorSubs.length !== 1 ? "s" : ""}
                                    </span>
                                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        onClick={() => openEditMajor(major)}
                                        className="p-1 rounded-lg text-ink-faint hover:text-brand-dark hover:bg-brand-faint transition-colors"
                                      >
                                        <Pencil size={11} />
                                      </button>
                                      <SmallDeleteBtn
                                        asking={isDelConfirm("major", major.id)}
                                        onAsk={() => setDelConfirm({ t: "major", id: major.id })}
                                        onConfirm={() => { deleteMajor(major.id); setDelConfirm(null); }}
                                        onCancel={() => setDelConfirm(null)}
                                      />
                                    </div>
                                  </div>

                                  {/* Subjects (expanded) */}
                                  {isMajorOpen && (
                                    <div className="ml-5 pb-2 space-y-1">
                                      {majorSubs.length === 0 ? (
                                        <p className="text-xs text-ink-faint italic py-1">No subjects added yet.</p>
                                      ) : (
                                        majorSubs.map((sub) => (
                                          <div key={sub.id} className="flex items-center gap-2.5 py-1">
                                            <BookOpen size={11} className="text-ink-faint shrink-0" />
                                            {sub.course_code ? (
                                              <code className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-canvas border border-border text-ink-muted shrink-0">
                                                {sub.course_code}
                                              </code>
                                            ) : (
                                              <span className="text-[10px] text-ink-faint shrink-0 w-14 text-center">—</span>
                                            )}
                                            <span className="text-xs text-ink flex-1">{sub.name}</span>
                                            <div className="flex items-center gap-1 shrink-0">
                                              <button
                                                onClick={() => openEditSubject(sub)}
                                                className="p-1 rounded-lg text-ink-faint hover:text-brand-dark hover:bg-brand-faint transition-colors"
                                              >
                                                <Pencil size={11} />
                                              </button>
                                              <SmallDeleteBtn
                                                asking={isDelConfirm("subject", sub.id)}
                                                onAsk={() => setDelConfirm({ t: "subject", id: sub.id })}
                                                onConfirm={() => { deleteSubject(sub.id); setDelConfirm(null); }}
                                                onCancel={() => setDelConfirm(null)}
                                              />
                                            </div>
                                          </div>
                                        ))
                                      )}
                                      <button
                                        onClick={() => openCreateSubject(major.id)}
                                        className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-brand-dark hover:text-ink transition-colors px-2 py-1 rounded-lg hover:bg-brand-faint"
                                      >
                                        <Plus size={9} /> Add Subject
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {schools.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <GraduationCap size={32} className="text-ink-faint mb-3" />
            <p className="text-sm font-semibold text-ink">No schools yet</p>
            <p className="text-xs text-ink-muted mt-1">Click "Add New" to create the first school.</p>
          </div>
        )}
      </div>

      {/* ── School modal ── */}
      <Modal
        open={schoolModal.open}
        onClose={() => setSchoolModal({ open: false, editing: null })}
        title={schoolModal.editing ? "Edit School" : "New School"}
      >
        <div className="space-y-4">
          <div>
            <label className={LABEL}>School Name *</label>
            <input
              type="text" value={schoolForm.name}
              onChange={(e) => setSchoolForm((f) => ({ ...f, name: e.target.value }))}
              className={INPUT} placeholder="e.g., Singapore Institute of Management"
            />
          </div>
          <div>
            <label className={LABEL}>Abbreviation *</label>
            <input
              type="text" value={schoolForm.abbr}
              onChange={(e) => setSchoolForm((f) => ({ ...f, abbr: e.target.value }))}
              className={INPUT} placeholder="e.g., SIM"
              maxLength={10}
            />
            <p className="text-xs text-ink-faint mt-1">Will be stored in uppercase.</p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setSchoolModal({ open: false, editing: null })} className={BTN_GHOST}>Cancel</button>
            <button
              onClick={saveSchool}
              disabled={!schoolForm.name.trim() || !schoolForm.abbr.trim() || saving}
              className={BTN_PRI}
            >
              {saving ? "Saving…" : schoolModal.editing ? "Save Changes" : "Create School"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Major modal ── */}
      <Modal
        open={majorModal.open}
        onClose={() => setMajorModal((p) => ({ ...p, open: false }))}
        title={majorModal.editing ? "Edit Major" : `New Major · ${majorModal.level}`}
      >
        <div className="space-y-4">
          <div>
            <label className={LABEL}>Major Name *</label>
            <input
              type="text" value={majorForm.name}
              onChange={(e) => setMajorForm((f) => ({ ...f, name: e.target.value }))}
              className={INPUT} placeholder="e.g., Computer Science"
            />
          </div>
          <div>
            <label className={LABEL}>Education Level</label>
            <select
              value={majorForm.education_level}
              onChange={(e) => setMajorForm((f) => ({ ...f, education_level: e.target.value as EduLevel }))}
              className={INPUT}
            >
              {EDU_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setMajorModal((p) => ({ ...p, open: false }))} className={BTN_GHOST}>Cancel</button>
            <button onClick={saveMajor} disabled={!majorForm.name.trim() || saving} className={BTN_PRI}>
              {saving ? "Saving…" : majorModal.editing ? "Save Changes" : "Create Major"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Subject modal ── */}
      <Modal
        open={subjectModal.open}
        onClose={() => setSubjectModal((p) => ({ ...p, open: false }))}
        title={subjectModal.editing ? "Edit Subject" : "New Subject"}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Course Code</label>
              <input
                type="text" value={subjectForm.course_code}
                onChange={(e) => setSubjectForm((f) => ({ ...f, course_code: e.target.value }))}
                className={INPUT} placeholder="CSIT111"
                maxLength={12}
              />
              <p className="text-xs text-ink-faint mt-1">Auto-uppercased.</p>
            </div>
            <div className="col-span-2">
              <label className={LABEL}>Subject Name *</label>
              <input
                type="text" value={subjectForm.name}
                onChange={(e) => setSubjectForm((f) => ({ ...f, name: e.target.value }))}
                className={INPUT} placeholder="e.g., Programming Fundamentals"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setSubjectModal((p) => ({ ...p, open: false }))} className={BTN_GHOST}>Cancel</button>
            <button onClick={saveSubject} disabled={!subjectForm.name.trim() || saving} className={BTN_PRI}>
              {saving ? "Saving…" : subjectModal.editing ? "Save Changes" : "Add Subject"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

const VALID_TABS = new Set<Tab>(["overview", "events", "rewards", "users", "locations", "reviews", "rules", "schools"]);

function AdminPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab") as Tab | null;
  const tab: Tab = rawTab && VALID_TABS.has(rawTab) ? rawTab : "overview";

  const [err, setErr] = useState<string | null>(null);

  function switchTab(id: Tab) {
    router.replace(`/admin?tab=${id}`, { scroll: false });
  }

  return (
    <AdminErrorCtx.Provider value={setErr}>
      <div className="min-h-full bg-canvas px-4 pt-6 pb-16 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-6">

          <div>
            <h1 className="text-2xl font-extrabold text-ink">Admin Panel</h1>
            <p className="text-sm text-ink-muted mt-1">
              Manage campus content, users, and gamification.
            </p>
          </div>

          {/* Error banner */}
          <AnimatePresence>
            {err && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                className="flex items-start gap-3 rounded-xl border border-alert/30 bg-alert-light px-4 py-3 text-sm text-alert"
              >
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span className="flex-1">{err}</span>
                <button onClick={() => setErr(null)} className="shrink-0 text-alert/60 hover:text-alert transition-colors">
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tab navigation */}
          <div className="flex gap-1 overflow-x-auto pb-0.5">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => switchTab(id)}
                className={[
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150",
                  tab === id
                    ? "bg-ink text-surface shadow-sm"
                    : "text-ink-muted hover:text-ink hover:bg-surface",
                ].join(" ")}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              {tab === "overview"  && <OverviewTab />}
              {tab === "events"    && <EventsTab />}
              {tab === "rewards"   && <RewardsTab />}
              {tab === "users"     && <UsersTab />}
              {tab === "locations" && <LocationsTab />}
              {tab === "reviews"   && <ReviewsTab />}
              {tab === "rules"     && <PointRulesTab />}
              {tab === "schools"   && <SchoolsTab />}
            </motion.div>
          </AnimatePresence>

        </div>
      </div>
    </AdminErrorCtx.Provider>
  );
}

export default function AdminPage() {
  return (
    <Suspense>
      <AdminPageContent />
    </Suspense>
  );
}
