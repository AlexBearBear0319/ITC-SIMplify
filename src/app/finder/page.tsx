"use client";


import { useState, useMemo, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { createClient } from "@/utils/supabase/client";
import { joinStudyGroup, leaveStudyGroup, createStudyGroup } from "@/lib/db/study-groups";
import { awardPoints, POINT_ACTIONS, trackMissionProgress } from "@/lib/db/points";
import QRScannerModal from "@/components/features/QRScannerModal";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  MapPin,
  Users,
  Plus,
  Minus,
  X,
  BookOpen,
  Clock,
  ChevronDown,
  Coins,
  CheckCircle2,
  UserCircle,
  SlidersHorizontal,
  LogOut,
  QrCode,
  AlertCircle,
  Trophy,
} from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type StudyGroup = {
  id: number;
  host_id: string;
  location_id: number;
  subject: string;
  description: string;
  max_members: number;
  current_members: number;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  profiles:  { username: string; avatar_url: string | null };
  locations: { name: string; category: string };
};

type UserProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
  school_id: number | null;
  major_id: number | null;
};

type CreateForm = {
  subject: string;
  description: string;
  location_id: number;
  max_members: number;
  duration_minutes: number;
};


const POPULAR_SUBJECTS = ["Python", "React", "Statistics", "Writing", "DSA", "Security", "Design"];

type Subject = { id: number; name: string; course_code: string | null };

type GroupMember = {
  user_id: string;
  profiles: { username: string; avatar_url: string | null };
};

// ─────────────────────────────────────────────
// Animation variants
// ─────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07, delayChildren: 0.02 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getCapacityInfo(current: number, max: number) {
  const ratio = current / max;
  if (ratio >= 1)   return { pipColor: "bg-alert",   label: "Full",    bg: "bg-alert-light",   text: "text-alert"   };
  if (ratio >= 0.7) return { pipColor: "bg-gold",    label: "Filling", bg: "bg-gold-light",    text: "text-gold"    };
  return               { pipColor: "bg-success", label: "Open",   bg: "bg-success-light", text: "text-success" };
}

// ─────────────────────────────────────────────
// GroupDetailDialog
// ─────────────────────────────────────────────

function MemberAvatar({ username, isHost }: { username: string; isHost?: boolean }) {
  const [showTip, setShowTip] = useState(false);
  const tipRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initials = username.slice(0, 2).toUpperCase();
  return (
    <div
      className="relative"
      onMouseEnter={() => { tipRef.current = setTimeout(() => setShowTip(true), 300); }}
      onMouseLeave={() => { if (tipRef.current) clearTimeout(tipRef.current); setShowTip(false); }}
      onTouchStart={() => setShowTip((v) => !v)}
    >
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 border-surface shadow-sm ${isHost ? "bg-brand text-ink" : "bg-canvas text-ink-muted"}`}
      >
        {initials}
      </div>
      {showTip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-ink text-surface text-[11px] font-medium rounded-lg whitespace-nowrap shadow-md pointer-events-none z-10">
          @{username}{isHost ? " · host" : ""}
        </div>
      )}
    </div>
  );
}

function GroupDetailDialog({
  group,
  activeGroupId,
  currentUserId,
  supabase,
  onJoin,
  onLeave,
  onClose,
}: {
  group: StudyGroup;
  activeGroupId: number | null;
  currentUserId: string | null;
  supabase: ReturnType<typeof createClient>;
  onJoin: (id: number) => void;
  onLeave: (id: number) => void;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<GroupMember[]>([]);

  // Fetch real members and subscribe to live updates for this group
  useEffect(() => {
    const fetchMembers = () =>
      supabase
        .from("study_group_members")
        .select("user_id, profiles(username, avatar_url)")
        .eq("group_id", group.id)
        .then(({ data }) => { if (data) setMembers(data as unknown as GroupMember[]); });

    fetchMembers();

    const channel = supabase
      .channel(`group-members-${group.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "study_group_members", filter: `group_id=eq.${group.id}` }, fetchMembers)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [group.id, supabase]);

  // The host avatar is always rendered explicitly outside the members list.
  // liveCount must account for the host even if their junction-table row is absent.
  const nonHostMembers     = members.filter((m) => m.user_id !== group.host_id);
  const totalCapacity      = Math.max(1, group.max_members);
  const liveCount          = members.length > 0
    ? Math.min(totalCapacity, nonHostMembers.length + 1)  // non-host members + 1 for the explicit host slot
    : Math.min(totalCapacity, Math.max(1, group.current_members));
  const cap                = getCapacityInfo(liveCount, totalCapacity);
  const isFull             = liveCount >= totalCapacity;
  // Check in-memory state OR actual membership list OR host identity so the correct
  // button shows even after a page refresh or if activeGroupId hasn't synced yet
  const isThisGroupActive  =
    activeGroupId === group.id ||
    group.host_id === currentUserId ||
    members.some((m) => m.user_id === currentUserId);
  const hasOtherActiveGroup = activeGroupId !== null && activeGroupId !== group.id && !isThisGroupActive;
  const emptySlots         = Math.max(0, totalCapacity - liveCount);
  const hostInitials       = group.profiles.username.slice(0, 2).toUpperCase();

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay/50 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby="group-detail-desc"
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 bg-surface rounded-2xl shadow-xl outline-none max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-border">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full ${cap.bg} ${cap.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cap.pipColor}`} />
                    {cap.label} · {liveCount}/{group.max_members}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-faint text-brand-dark text-[10px] font-semibold rounded-full border border-brand/30">
                    <BookOpen size={9} />
                    {group.locations.category}
                  </span>
                  {isThisGroupActive && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-success-light text-success text-[10px] font-semibold rounded-full border border-success/30">
                      ✓ Your session
                    </span>
                  )}
                </div>
                <Dialog.Title className="text-lg font-bold text-ink leading-snug pr-2">
                  {group.subject}
                </Dialog.Title>
              </div>
              <Dialog.Close className="shrink-0 p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-brand-faint transition-colors mt-1">
                <X size={16} />
              </Dialog.Close>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-5">
            {/* Description */}
            <Dialog.Description id="group-detail-desc" className="text-sm text-ink-muted leading-relaxed">
              {group.description || "No description provided."}
            </Dialog.Description>

            {/* Meta */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-brand-light flex items-center justify-center text-[10px] font-bold text-ink shrink-0">
                  {hostInitials}
                </div>
                <span className="text-xs text-ink-muted">
                  Hosted by{" "}
                  <span className="font-semibold text-ink">@{group.profiles.username}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-muted">
                <MapPin size={13} className="shrink-0 text-brand-dark" />
                <span>{group.locations.name}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-muted">
                <Clock size={13} className="shrink-0" />
                <span>Started {timeAgo(group.created_at)}</span>
              </div>
            </div>

            {/* Participants — real data from study_group_members */}
            <div>
              <p className="text-xs font-semibold text-ink-muted mb-2.5">
                Participants ({liveCount}/{group.max_members})
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Host */}
                <MemberAvatar username={group.profiles.username} isHost />
                {/* Other members (excluding host) */}
                {members
                  .filter((m) => m.user_id !== group.host_id)
                  .map((m) => (
                    <MemberAvatar
                      key={m.user_id}
                      username={(m.profiles as unknown as { username: string }).username}
                    />
                  ))
                }
                {/* Empty slots */}
                {Array.from({ length: emptySlots }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="w-9 h-9 rounded-full border-2 border-dashed border-border flex items-center justify-center"
                  >
                    <Plus size={12} className="text-ink-faint" />
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-ink-faint mt-2">Hover a member to see their username</p>
            </div>

            {/* One-active-group warning */}
            {hasOtherActiveGroup && (
              <div className="flex items-start gap-2.5 p-3 bg-gold-light rounded-xl border border-gold/30">
                <Users size={14} className="text-gold shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-ink">Already in another group</p>
                  <p className="text-[11px] text-ink-muted mt-0.5">
                    Leave your current session first to join this one.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer action */}
          <div className="px-6 pb-6">
            {isThisGroupActive ? (
              <button
                onClick={() => onLeave(group.id)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-alert-light hover:bg-alert/20 text-alert border border-alert/40 font-semibold text-sm rounded-full transition-all duration-200 active:scale-[0.98]"
              >
                <LogOut size={15} />
                Leave Group
              </button>
            ) : hasOtherActiveGroup ? (
              <button
                disabled
                className="w-full flex items-center justify-center gap-2 py-3 bg-canvas text-ink-faint border border-border font-semibold text-sm rounded-full cursor-not-allowed"
              >
                <Users size={15} />
                Leave current group first
              </button>
            ) : isFull ? (
              <div className="w-full flex items-center justify-center gap-2 py-3 bg-canvas text-ink-muted border border-border font-medium text-sm rounded-full">
                <Users size={15} />
                Session is full
              </div>
            ) : (
              <button
                onClick={() => onJoin(group.id)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-brand hover:bg-brand-dark text-ink border border-brand font-semibold text-sm rounded-full transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
              >
                <Plus size={15} />
                Join Session · +5 pts
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─────────────────────────────────────────────
// StudyGroupCard
// ─────────────────────────────────────────────

function StudyGroupCard({
  group,
  activeGroupId,
  currentUserId,
  now,
  onExpire,
  onSelect,
  onJoin,
  onLeave,
}: {
  group: StudyGroup;
  activeGroupId: number | null;
  currentUserId: string | null;
  now: Date;
  onExpire: (id: number) => void;
  onSelect: () => void;
  onJoin: (id: number) => void;
  onLeave: (id: number) => void;
}) {
  const totalCapacity    = Math.max(1, group.max_members);
  const memberCount      = Math.min(totalCapacity, Math.max(1, group.current_members));
  const cap              = getCapacityInfo(memberCount, totalCapacity);
  const isFull           = memberCount >= totalCapacity;
  const spotsLeft        = totalCapacity - memberCount;
  const initials         = group.profiles.username.slice(0, 2).toUpperCase();
  const isThisGroupActive   = activeGroupId === group.id || group.host_id === currentUserId;
  const hasOtherActiveGroup = activeGroupId !== null && !isThisGroupActive;
  const pipCount  = Math.min(totalCapacity, 8);
  const pipFilled = Math.min(memberCount, pipCount);

  const expiresAt  = group.expires_at ? new Date(group.expires_at) : null;
  const msLeft     = expiresAt ? expiresAt.getTime() - now.getTime() : null;
  const isExpired  = msLeft !== null && msLeft <= 0;
  const minsLeft   = msLeft !== null ? Math.max(0, Math.floor(msLeft / 60_000)) : null;
  const secsLeft   = msLeft !== null ? Math.max(0, Math.floor((msLeft % 60_000) / 1_000)) : null;

  useEffect(() => {
    if (isExpired && group.is_active) {
      onExpire(group.id);
    }
  }, [isExpired, group.is_active, group.id, onExpire]);

  return (
    <div
      onClick={onSelect}
      className="group flex flex-col bg-surface rounded-2xl border border-border shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 ease-in-out overflow-hidden cursor-pointer"
    >
      {/* Card header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-faint text-brand-dark text-[10px] font-semibold rounded-full border border-brand/30">
            <BookOpen size={9} />
            {group.locations.category}
          </span>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="flex items-center gap-1 text-ink-faint">
              <Clock size={10} />
              {timeAgo(group.created_at)}
            </span>
            {expiresAt && (
              <span
                className={`flex items-center gap-1 font-semibold ${
                  isExpired ? "text-alert" : msLeft !== null && msLeft <= 5 * 60_000 ? "text-gold" : "text-ink-muted"
                }`}
              >
                <Clock size={10} />
                {isExpired ? "Expired" : `${minsLeft}:${String(secsLeft ?? 0).padStart(2, "0")} left`}
              </span>
            )}
          </div>
        </div>

        <h3 className="text-base font-bold text-ink leading-snug line-clamp-2 mb-1.5">
          {group.subject}
        </h3>

        <p className="text-xs text-ink-muted leading-relaxed line-clamp-2">
          {group.description}
        </p>
      </div>

      {/* Member capacity bar */}
      <div className="px-5 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            {Array.from({ length: pipCount }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                  i < pipFilled ? cap.pipColor : "bg-border"
                }`}
              />
            ))}
          </div>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cap.bg} ${cap.text}`}>
            {cap.label} · {memberCount}/{totalCapacity}
          </span>
        </div>
        <div className="h-1 bg-canvas rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${cap.pipColor}`}
            style={{ width: `${(memberCount / totalCapacity) * 100}%` }}
          />
        </div>
      </div>

      <div className="mx-5 border-t border-border" />

      {/* Card footer */}
      <div className="px-5 py-4 flex items-center justify-between gap-3">
        {/* Host + location */}
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-brand-light flex items-center justify-center text-[9px] font-bold text-ink shrink-0">
              {initials}
            </div>
            <span className="text-xs text-ink-muted truncate">@{group.profiles.username}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-ink-faint">
            <MapPin size={9} className="shrink-0" />
            <span className="truncate">{group.locations.name}</span>
          </div>
        </div>

        {/* Quick action button — stopPropagation so card click doesn't fire too */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isThisGroupActive) onLeave(group.id);
            else if (!hasOtherActiveGroup && !isFull && !isExpired) onJoin(group.id);
          }}
          disabled={hasOtherActiveGroup || isExpired || (!isThisGroupActive && isFull)}
          className={`
            shrink-0 flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full
            transition-all duration-200 active:scale-[0.97]
            ${isThisGroupActive
              ? "bg-alert-light text-alert border border-alert/40 hover:bg-alert/20"
              : hasOtherActiveGroup
                ? "bg-canvas text-ink-faint border border-border cursor-not-allowed"
                : isExpired
                  ? "bg-canvas text-ink-faint border border-border cursor-not-allowed"
                  : isFull
                  ? "bg-canvas text-ink-faint border border-border cursor-not-allowed"
                  : "bg-brand hover:bg-brand-dark text-ink border border-brand hover:border-brand-dark hover:shadow-sm"
            }
          `}
        >
          {isThisGroupActive ? (
            <><LogOut size={12} /> Leave</>
          ) : isExpired ? (
            <><Clock size={12} /> Expired</>
          ) : isFull ? (
            <><Users size={12} /> Full</>
          ) : hasOtherActiveGroup ? (
            <><Users size={12} /> Taken</>
          ) : (
            <><Plus size={12} /> Join ({spotsLeft})</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Create Group Dialog
// ─────────────────────────────────────────────

const FORM_INPUT =
  "w-full px-3 py-2.5 bg-canvas border border-border rounded-xl text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-colors resize-none";
const FORM_LABEL = "block text-xs font-semibold text-ink-muted mb-1.5";

function CreateGroupDialog({
  open,
  onOpenChange,
  onSubmit,
  locationsList,
  subjects,
  defaultLocationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (form: CreateForm) => Promise<void>;
  locationsList: { id: number; name: string }[];
  subjects: Subject[];
  defaultLocationId?: number;
}) {
  const [form,        setForm]        = useState<CreateForm>({ subject: "", description: "", location_id: defaultLocationId ?? 0, max_members: 4, duration_minutes: 60 });
  const [submitting,  setSubmitting]  = useState(false);
  const [success,     setSuccess]     = useState(false);

  // When dialog reopens (new QR scan may have changed defaultLocationId), reset form location
  useEffect(() => {
    if (open) {
      setForm((f) => ({ ...f, location_id: defaultLocationId ?? f.location_id }));
    }
  }, [open, defaultLocationId]);

  const isValid = form.subject.trim().length > 0 && form.location_id > 0;

  const handleOpenChange = (next: boolean) => {
    if (!next && !submitting) {
      setForm({ subject: "", description: "", location_id: defaultLocationId ?? 0, max_members: 4, duration_minutes: 60 });
      setSuccess(false);
    }
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    await onSubmit(form);
    setSuccess(true);
    setSubmitting(false);
    setTimeout(() => {
      setForm({ subject: "", description: "", location_id: defaultLocationId ?? 0, max_members: 4, duration_minutes: 60 });
      setSuccess(false);
      onOpenChange(false);
    }, 1400);
  };

  const set = <K extends keyof CreateForm>(k: K, v: CreateForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay/50 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby="create-dialog-desc"
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 bg-surface rounded-2xl shadow-xl outline-none"
        >
          {success ? (
            <div className="flex flex-col items-center justify-center py-12 px-8 text-center">
              <div className="w-16 h-16 rounded-full bg-success-light flex items-center justify-center mb-4">
                <CheckCircle2 size={30} className="text-success" />
              </div>
              <p className="text-lg font-bold text-ink">Session Created!</p>
              <p className="text-sm text-ink-muted mt-1">
                Your study group is live. Others can join now.
              </p>
              <div className="flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-gold-light rounded-full border border-gold/30">
                <Coins size={13} className="text-gold" />
                <span className="text-sm font-bold text-gold">+20 pts earned</span>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between p-6 pb-0">
                <div>
                  <Dialog.Title className="text-base font-bold text-ink leading-tight">
                    Start a Study Session
                  </Dialog.Title>
                  <Dialog.Description id="create-dialog-desc" className="text-xs text-ink-muted mt-0.5">
                    Create a group and earn{" "}
                    <span className="text-gold font-semibold">+20 pts</span>
                  </Dialog.Description>
                </div>
                <Dialog.Close className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-brand-faint transition-colors mt-0.5">
                  <X size={16} />
                </Dialog.Close>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className={FORM_LABEL}>
                    Subject <span className="text-alert">*</span>
                  </label>
                  {subjects.length > 0 ? (
                    <div className="relative">
                      <select
                        value={form.subject}
                        onChange={(e) => set("subject", e.target.value)}
                        className={`${FORM_INPUT} appearance-none pr-8 cursor-pointer`}
                      >
                        <option value="">Choose a subject…</option>
                        {subjects.map((s) => {
                          const label = s.course_code ? `${s.course_code} — ${s.name}` : s.name;
                          return (
                            <option key={s.id} value={label}>{label}</option>
                          );
                        })}
                      </select>
                      <ChevronDown
                        size={13}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
                      />
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={form.subject}
                        onChange={(e) => set("subject", e.target.value)}
                        placeholder="e.g., Python for Data Science"
                        maxLength={80}
                        className={FORM_INPUT}
                      />
                      <p className="text-xs text-ink-faint mt-1">
                        Set your school &amp; major in your profile to see subject options.
                      </p>
                    </>
                  )}
                </div>

                <div>
                  <label className={FORM_LABEL}>
                    Description{" "}
                    <span className="font-normal text-ink-faint">(optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder="What will you be working on? Any tools or materials needed?"
                    maxLength={200}
                    className={FORM_INPUT}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={FORM_LABEL}>
                      Location <span className="text-alert">*</span>
                    </label>
                    {defaultLocationId ? (
                      /* Location locked to QR-scanned spot */
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-success-light border border-success/30 rounded-xl text-sm text-ink">
                        <QrCode size={13} className="text-success shrink-0" />
                        <span className="flex-1 font-medium truncate">
                          {locationsList.find((l) => l.id === defaultLocationId)?.name ?? "Scanned location"}
                        </span>
                        <span className="shrink-0 text-[10px] font-semibold text-success">QR Verified ✓</span>
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          value={form.location_id}
                          onChange={(e) => set("location_id", Number(e.target.value))}
                          className={`${FORM_INPUT} appearance-none pr-8 cursor-pointer`}
                        >
                          <option value={0} disabled>Choose…</option>
                          {locationsList.map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={13}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className={FORM_LABEL}>Max Members (incl. you)</label>
                    <div className="flex items-center gap-2 px-3 py-2 bg-canvas border border-border rounded-xl">
                      <button
                        type="button"
                        onClick={() => set("max_members", Math.max(2, form.max_members - 1))}
                        className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center text-ink-muted hover:text-ink hover:bg-brand-faint transition-colors"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="flex-1 text-center text-sm font-bold text-ink">
                        {form.max_members}
                      </span>
                      <button
                        type="button"
                        onClick={() => set("max_members", Math.min(10, form.max_members + 1))}
                        className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center text-ink-muted hover:text-ink hover:bg-brand-faint transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className={FORM_LABEL}>Duration</label>
                  <div className="relative">
                    <select
                      value={form.duration_minutes}
                      onChange={(e) => setForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))}
                      className={`${FORM_INPUT} appearance-none pr-8 cursor-pointer`}
                    >
                      <option value={30}>30 minutes</option>
                      <option value={60}>1 hour</option>
                      <option value={120}>2 hours</option>
                      <option value={240}>4 hours</option>
                    </select>
                    <ChevronDown
                      size={13}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6">
                <button
                  onClick={handleSubmit}
                  disabled={!isValid || submitting}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-brand hover:bg-brand-dark text-ink font-semibold text-sm rounded-full transition-all duration-200 hover:shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="animate-pulse">Creating session…</span>
                  ) : (
                    <>
                      <Coins size={14} className="text-gold" />
                      Start Session · +20 pts
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─────────────────────────────────────────────
// Styled select wrapper
// ─────────────────────────────────────────────

function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 bg-surface border border-border rounded-xl text-sm text-ink cursor-pointer hover:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40 transition-colors"
      >
        {children}
      </select>
      <ChevronDown
        size={13}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page Content
// ─────────────────────────────────────────────

function FinderPageContent() {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [currentUser,     setCurrentUser]     = useState<UserProfile | null>(null);
  const [groups,          setGroups]          = useState<StudyGroup[]>([]);
  const [locationsList,   setLocationsList]   = useState<{ id: number; name: string }[]>([]);
  const [subjects,        setSubjects]        = useState<Subject[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [searchQuery,     setSearchQuery]     = useState("");
  const [locationFilter,  setLocationFilter]  = useState("all");

  // ── Fetch all active study groups (with joined profile + location data) ──
  // Always computes current_members from actual study_group_members rows so
  // the card count can never be stale or inflated by a counter drift.
  const fetchGroups = async () => {
    const { data } = await supabase
      .from("study_groups")
      .select("*, profiles(username, avatar_url), locations(name, category)")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (!data) { setLoading(false); return; }

    // One extra query: pull every member row (with user_id) so we can count correctly.
    const ids = data.map((g) => g.id as number);
    const { data: memberRows } = ids.length
      ? await supabase.from("study_group_members").select("group_id, user_id").in("group_id", ids)
      : { data: [] };

    // Build a set per group so we can detect if the host row is present.
    // The host is always a member even if their study_group_members row is missing.
    const memberSets: Record<number, Set<string>> = {};
    (memberRows ?? []).forEach((m: { group_id: number; user_id: string }) => {
      if (!memberSets[m.group_id]) memberSets[m.group_id] = new Set();
      memberSets[m.group_id].add(m.user_id);
    });

    // Override current_members with the real count and self-heal stale DB counters
    const mapped = data.map((g) => {
      const memberSet = memberSets[g.id] ?? new Set<string>();
      // Host is always a member; add them if their row was missing from the junction table
      if (g.host_id) memberSet.add(g.host_id as string);
      const real = Math.max(1, memberSet.size);
      if (g.current_members !== real) {
        // Fire-and-forget: sync the counter in the background
        supabase
          .from("study_groups")
          .update({ current_members: real })
          .eq("id", g.id)
          .then(() => {});
      }
      return { ...g, current_members: real };
    });

    setGroups(mapped as StudyGroup[]);
    setLoading(false);
  };

  // Fetch the logged-in user's profile (including school/major for subject filtering)
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, school_id, major_id")
        .eq("id", user.id)
        .single();
      if (data) {
        setCurrentUser(data as UserProfile);

        // Restore the user's active group across page refreshes.
        // Two-step: find their group memberships, then pick the one that's still active.
        supabase
          .from("study_group_members")
          .select("group_id")
          .eq("user_id", data.id)
          .then(async ({ data: memberships }) => {
            if (!memberships?.length) return;
            const { data: active } = await supabase
              .from("study_groups")
              .select("id")
              .eq("is_active", true)
              .in("id", memberships.map((m) => m.group_id))
              .limit(1)
              .maybeSingle();
            if (active) setActiveGroupId(active.id);
          });

        // Check for an active solo check-in session (blocks group creation)
        supabase
          .from("active_sessions")
          .select("id, check_in_time, duration_minutes")
          .eq("user_id", data.id)
          .eq("is_active", true)
          .maybeSingle()
          .then(({ data: session }) => {
            if (!session) return;
            const expiresAt = new Date(session.check_in_time ?? 0).getTime() + session.duration_minutes * 60_000;
            if (Date.now() < expiresAt) {
              setExistingSoloSession(true);
            } else {
              // Auto-expire stale session
              supabase.from("active_sessions").update({ is_active: false }).eq("id", session.id);
            }
          });

        // Daily cooldown: has user already earned study-group points today?
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        supabase
          .from("study_group_members")
          .select("id", { count: "exact", head: true })
          .eq("user_id", data.id)
          .gte("joined_at", todayStart.toISOString())
          .then(({ count }) => { if ((count ?? 0) > 0) setAlreadyEarnedToday(true); });

        // Load subjects for this user's major
        if (data.major_id) {
          supabase
            .from("subjects")
            .select("id, name, course_code")
            .eq("major_id", data.major_id)
            .order("name")
            .then(({ data: subs }) => { if (subs) setSubjects(subs); });
        }
      }
    });
  }, []);

  // Initial data load: groups + locations list + point rules
  useEffect(() => {
    // Auto-close study groups that have passed their expires_at time
    const now = new Date().toISOString();
    supabase
      .from("study_groups")
      .update({ is_active: false })
      .eq("is_active", true)
      .not("expires_at", "is", null)
      .lt("expires_at", now)
      .then(() => {});
    fetchGroups();
    supabase
      .from("locations")
      .select("id, name")
      .order("name")
      .then(({ data }) => { if (data) setLocationsList(data); });
    supabase
      .from("point_rules")
      .select("action_name, points_awarded")
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, number> = {};
          for (const r of data) map[r.action_name] = r.points_awarded ?? 0;
          setPointRules(map);
        }
      });
  }, []);

  // Realtime: re-fetch groups whenever study_groups or study_group_members change
  useEffect(() => {
    const channel = supabase
      .channel("finder-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "study_groups" }, fetchGroups)
      .on("postgres_changes", { event: "*", schema: "public", table: "study_group_members" }, fetchGroups)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Pre-filter by locationId query param (set when navigating from map drawer)
  useEffect(() => {
    const locId = searchParams.get("locationId");
    if (locId) setLocationFilter(locId);
  }, [searchParams]);
  const [slotsFilter,        setSlotsFilter]        = useState("all");
  const [activeGroupId,      setActiveGroupId]      = useState<number | null>(null);
  const [selectedGroupId,    setSelectedGroupId]    = useState<number | null>(null);
  const [qrScanOpen,         setQrScanOpen]         = useState(false);
  const [createOpen,         setCreateOpen]         = useState(false);
  const [scannedLocationId,  setScannedLocationId]  = useState<number | undefined>(undefined);
  const [pointsDelta,        setPointsDelta]        = useState<number | null>(null);
  const [pointRules,         setPointRules]         = useState<Record<string, number>>({});
  // Session-guard state
  const [existingSoloSession,  setExistingSoloSession]  = useState(false);   // user has an active solo check-in
  const [alreadyEarnedToday,   setAlreadyEarnedToday]   = useState(false);   // daily cooldown for group points
  const [blockToast,           setBlockToast]           = useState<string | null>(null); // inline message
  const [newBadgeName,         setNewBadgeName]         = useState<string | null>(null);
  const [countdownNow,         setCountdownNow]         = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setCountdownNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);

  // If the host disbanded the group the user was in, the group disappears from the
  // active list but activeGroupId stays set — blocking the user from joining again.
  // This effect detects that and clears the stale state + orphaned membership row.
  useEffect(() => {
    if (activeGroupId === null || activeGroupId === -1 || !currentUser) return;
    const stillActive = groups.some((g) => g.id === activeGroupId);
    if (!stillActive) {
      // Remove the stale membership row so join counts stay accurate
      supabase
        .from("study_group_members")
        .delete()
        .eq("group_id", activeGroupId)
        .eq("user_id", currentUser.id)
        .then(() => {});
      setActiveGroupId(null);
    }
  }, [groups, activeGroupId, currentUser, supabase]);

  // Always derive live group data from current state so dialog re-renders on join/leave
  const selectedGroup = selectedGroupId !== null
    ? groups.find((g) => g.id === selectedGroupId) ?? null
    : null;

  // ── Derived filtered list ──────────────────
  const filteredGroups = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return groups
      .filter((g) => {
        if (!g.is_active) return false;
        const matchesSearch   = q === "" || g.subject.toLowerCase().includes(q);
        const matchesLocation = locationFilter === "all" || g.location_id === Number(locationFilter);
        const matchesSlots    =
          slotsFilter === "all"       ? true :
          slotsFilter === "available" ? g.current_members < g.max_members :
                                        g.current_members >= g.max_members;
        return matchesSearch && matchesLocation && matchesSlots;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [groups, searchQuery, locationFilter, slotsFilter]);

  const activeFilterCount = [
    searchQuery !== "",
    locationFilter !== "all",
    slotsFilter !== "all",
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearchQuery("");
    setLocationFilter("all");
    setSlotsFilter("all");
  };

  // ── Handlers ──────────────────────────────

  const showPointsAnim = (action: string) => {
    const pts = pointRules[action] ?? 0;
    if (pts > 0) {
      setPointsDelta(pts);
      setTimeout(() => setPointsDelta(null), 2500);
    }
  };

  useEffect(() => {
    if (!newBadgeName) return;
    const t = setTimeout(() => setNewBadgeName(null), 3000);
    return () => clearTimeout(t);
  }, [newBadgeName]);

  const showBlockToast = (msg: string) => {
    setBlockToast(msg);
    setTimeout(() => setBlockToast(null), 4000);
  };

  const handleJoinGroup = async (id: number) => {
    if (!currentUser) return;
    // Guard: one active session at a time
    if (activeGroupId !== null) {
      showBlockToast("Leave your current study session first before joining another.");
      return;
    }
    if (existingSoloSession) {
      showBlockToast("You have an active solo check-in. End it on the location page before joining a group.");
      return;
    }
    const { error } = await joinStudyGroup(supabase, id, currentUser.id);
    if (error) {
      showBlockToast(error === "This study group is full." ? "This session is already full." : error);
      return;
    }
    // Optimistic update: bump the card count immediately
    setGroups((prev) =>
      prev.map((g) => g.id === id ? { ...g, current_members: g.current_members + 1 } : g)
    );
    // Daily cooldown: only award points once per day
    if (!alreadyEarnedToday) {
      await awardPoints(supabase, currentUser.id, POINT_ACTIONS.JOIN_STUDY_GROUP);
      showPointsAnim(POINT_ACTIONS.JOIN_STUDY_GROUP);
      setAlreadyEarnedToday(true);
      try { sessionStorage.setItem("simplify_points_dirty", "1"); } catch { /* ignore */ }
    }
    trackMissionProgress(supabase, currentUser.id, POINT_ACTIONS.JOIN_GROUP);
    const joinedGroup = groups.find((g) => g.id === id);
    supabase.from("activity_log").insert({
      user_id: currentUser.id,
      type: "group",
      description: `Joined a study group: ${joinedGroup?.subject ?? "Study Session"}`,
    });

    // Check for newly unlocked achievements
    const { data: before } = await supabase.from("user_achievements").select("achievement_id").eq("user_id", currentUser.id);
    const beforeIds = new Set((before ?? []).map((r: { achievement_id: number }) => r.achievement_id));
    await supabase.rpc("check_and_unlock_achievements", { p_user_id: currentUser.id });
    const { data: after } = await supabase.from("user_achievements").select("achievement_id, achievements(name)").eq("user_id", currentUser.id);
    const newlyUnlocked = (after ?? []).filter((r: { achievement_id: number }) => !beforeIds.has(r.achievement_id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (newlyUnlocked.length > 0) setNewBadgeName((newlyUnlocked[0] as any).achievements?.name ?? "Badge");
    setActiveGroupId(id);
    await fetchGroups();
  };

  const handleLeaveGroup = async (id: number) => {
    if (!currentUser || activeGroupId !== id) return;
    const { error } = await leaveStudyGroup(supabase, id, currentUser.id);
    if (error) { console.error("[handleLeaveGroup]", error); return; }
    // Clean up any study_group active_sessions row the host may have
    await supabase.from("active_sessions")
      .update({ is_active: false })
      .eq("user_id", currentUser.id)
      .eq("is_active", true)
      .eq("activity", "study_group");
    supabase.from("activity_log").insert({
      user_id: currentUser.id,
      type: "group",
      description: "Left a study group",
    });
    // Optimistic update: drop the card count immediately
    setGroups((prev) =>
      prev.map((g) =>
        g.id === id ? { ...g, current_members: Math.max(0, g.current_members - 1) } : g
      )
    );
    setActiveGroupId(null);
    await fetchGroups();
  };

  const expireGroup = useCallback(async (id: number) => {
    setGroups((prev) => prev.map((g) => g.id === id ? { ...g, is_active: false } : g));
    if (activeGroupId === id) setActiveGroupId(null);
    await supabase.from("study_groups").update({ is_active: false }).eq("id", id);
    await supabase.from("study_group_members").delete().eq("group_id", id);
  }, [supabase, activeGroupId]);

  const handleCreate = async (form: CreateForm) => {
    if (!currentUser) return;
    // Guard: one active session at a time
    if (activeGroupId !== null) {
      showBlockToast("You're already in a study session. Leave it first before creating a new one.");
      return;
    }
    if (existingSoloSession) {
      showBlockToast("You have an active solo check-in. End it on the location page before creating a group.");
      return;
    }

    // Optimistic: close the dialog and mark a pending group immediately (-1 signals
    // "in flight") so the session guards block double-creates during the DB round-trip.
    setCreateOpen(false);
    setScannedLocationId(undefined);
    setActiveGroupId(-1);

    const expiresAt = new Date(Date.now() + form.duration_minutes * 60_000).toISOString();
    const { data, error } = await createStudyGroup(supabase, {
      host_id:     currentUser.id,
      location_id: form.location_id,
      subject:     form.subject,
      description: form.description,
      max_members: form.max_members,
      duration_minutes: form.duration_minutes,
      expires_at:  expiresAt,
    });
    if (error || !data) {
      console.error("[handleCreate]", error);
      setActiveGroupId(null); // rollback
      showBlockToast(error ?? "Failed to create group. Please try again.");
      return;
    }
    // Daily cooldown: only award points once per day
    if (!alreadyEarnedToday) {
      await awardPoints(supabase, currentUser.id, POINT_ACTIONS.CREATE_STUDY_GROUP);
      showPointsAnim(POINT_ACTIONS.CREATE_STUDY_GROUP);
      setAlreadyEarnedToday(true);
      try { sessionStorage.setItem("simplify_points_dirty", "1"); } catch { /* ignore */ }
    }
    trackMissionProgress(supabase, currentUser.id, POINT_ACTIONS.CREATE_STUDY_GROUP);
    supabase.from("activity_log").insert({
      user_id: currentUser.id,
      type: "group",
      description: `Created a study group: ${form.subject}`,
    });

    // Check for newly unlocked achievements
    const { data: cBefore } = await supabase.from("user_achievements").select("achievement_id").eq("user_id", currentUser.id);
    const cBeforeIds = new Set((cBefore ?? []).map((r: { achievement_id: number }) => r.achievement_id));
    await supabase.rpc("check_and_unlock_achievements", { p_user_id: currentUser.id });
    const { data: cAfter } = await supabase.from("user_achievements").select("achievement_id, achievements(name)").eq("user_id", currentUser.id);
    const cNewlyUnlocked = (cAfter ?? []).filter((r: { achievement_id: number }) => !cBeforeIds.has(r.achievement_id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (cNewlyUnlocked.length > 0) setNewBadgeName((cNewlyUnlocked[0] as any).achievements?.name ?? "Badge");
    setActiveGroupId(data.id);
    await fetchGroups();
  };

  return (
    <>
      {/* Group detail dialog */}
      {selectedGroup && (
        <GroupDetailDialog
          group={selectedGroup}
          activeGroupId={activeGroupId}
          currentUserId={currentUser?.id ?? null}
          supabase={supabase}
          onJoin={handleJoinGroup}
          onLeave={handleLeaveGroup}
          onClose={() => setSelectedGroupId(null)}
        />
      )}

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

      {/* Badge unlock toast */}
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

      {/* Block toast */}
      <AnimatePresence>
        {blockToast && (
          <motion.div
            key="block-toast"
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: 8,   scale: 0.97 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-start gap-2.5 bg-ink text-surface text-sm font-medium px-4 py-3 rounded-2xl shadow-xl max-w-xs w-[calc(100vw-2rem)]"
          >
            <AlertCircle size={16} className="text-gold shrink-0 mt-0.5" />
            {blockToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR scanner — scans location QR, auto-detects location for the create form */}
      <QRScannerModal
        open={qrScanOpen}
        onOpenChange={(open) => { if (!open) setQrScanOpen(false); }}
        onSuccess={(locationId) => {
          // Guard before opening create dialog
          if (activeGroupId !== null) {
            setQrScanOpen(false);
            showBlockToast("You're already in a study session. Leave it first before creating a new one.");
            return;
          }
          if (existingSoloSession) {
            setQrScanOpen(false);
            showBlockToast("You have an active solo check-in. End it before creating a group.");
            return;
          }
          setScannedLocationId(locationId);
          setCreateOpen(true);
        }}
      />

      <CreateGroupDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setScannedLocationId(undefined);
        }}
        onSubmit={handleCreate}
        locationsList={locationsList}
        subjects={subjects}
        defaultLocationId={scannedLocationId}
      />

      <div className="px-3 py-3 md:px-4 md:py-4 lg:px-5 lg:py-5 max-w-6xl mx-auto space-y-3 md:space-y-4">

        {/* ── Page Header Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
          className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 p-4 md:p-5 bg-surface rounded-2xl border border-border shadow-sm"
        >
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-ink leading-tight">
              Study Buddy Finder
            </h1>
            <p className="text-sm text-ink-muted mt-1">
              Join an active session or start one — studying together makes it easier.
            </p>
          </div>

          <button
            onClick={() => setQrScanOpen(true)}
            className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-brand hover:bg-brand-dark text-ink font-semibold text-sm rounded-full transition-all duration-200 hover:shadow-sm active:scale-[0.97] shrink-0"
          >
            <Plus size={16} />
            Start a Session
          </button>
        </motion.div>

        {/* ── Active group banner ── */}
        {activeGroupId !== null && (() => {
          const activeGroup = groups.find((g) => g.id === activeGroupId);
          if (!activeGroup) return null;
          return (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 px-4 py-3 bg-success-light border border-success/30 rounded-2xl"
            >
              <CheckCircle2 size={16} className="text-success shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{activeGroup.subject}</p>
                <p className="text-xs text-ink-muted">{activeGroup.locations.name}</p>
              </div>
              <button
                onClick={() => handleLeaveGroup(activeGroupId)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-alert-light text-alert border border-alert/30 hover:bg-alert/20 transition-colors"
              >
                <LogOut size={12} /> Leave
              </button>
            </motion.div>
          );
        })()}

        {/* ── Solo session warning banner ── */}
        {existingSoloSession && activeGroupId === null && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 px-4 py-3 bg-gold-light border border-gold/30 rounded-2xl"
          >
            <AlertCircle size={16} className="text-gold shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink">Active check-in session</p>
              <p className="text-xs text-ink-muted">End your solo session on the location page to start a group.</p>
            </div>
          </motion.div>
        )}

        {/* ── Filter & Search Bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.07, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
          className="space-y-3"
        >
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search subjects (e.g. Python, Statistics…)"
                className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-xl text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="flex gap-2 shrink-0">
              <FilterSelect value={locationFilter} onChange={setLocationFilter}>
                <option value="all">All Locations</option>
                {locationsList.map((loc) => (
                  <option key={loc.id} value={String(loc.id)}>
                    {loc.name}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect value={slotsFilter} onChange={setSlotsFilter}>
                <option value="all">Any Slots</option>
                <option value="available">Has Slots</option>
                <option value="full">Full Only</option>
              </FilterSelect>
            </div>
          </div>

          {/* Quick subject tags */}
          <div className="flex items-center gap-2 flex-wrap">
            <SlidersHorizontal size={12} className="text-ink-faint shrink-0" />
            {POPULAR_SUBJECTS.map((tag) => {
              const isActive = searchQuery.toLowerCase() === tag.toLowerCase();
              return (
                <button
                  key={tag}
                  onClick={() => setSearchQuery(isActive ? "" : tag)}
                  className={`
                    px-2.5 py-1 text-xs font-medium rounded-full border transition-all duration-150
                    ${isActive
                      ? "bg-brand border-brand text-ink"
                      : "bg-surface border-border text-ink-muted hover:border-brand hover:text-ink"
                    }
                  `}
                >
                  {tag}
                </button>
              );
            })}
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="ml-1 text-xs font-medium text-alert hover:text-ink transition-colors flex items-center gap-0.5"
              >
                <X size={11} /> Clear ({activeFilterCount})
              </button>
            )}
          </div>
        </motion.div>

        {/* ── Results summary ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex items-center justify-between"
        >
          <p className="text-xs text-ink-muted">
            <span className="font-semibold text-ink">{filteredGroups.length}</span>{" "}
            {filteredGroups.length === 1 ? "session" : "sessions"} found
            {activeFilterCount > 0 && " · filtered"}
          </p>
          <div className="flex items-center gap-1 text-xs text-ink-muted">
            <UserCircle size={12} />
            {groups.reduce((s, g) => s + g.current_members, 0)} students studying now
          </div>
        </motion.div>

        {/* ── Cards Grid ── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-2xl bg-surface border border-border animate-pulse" />
            ))}
          </div>
        ) : (
        <motion.div
          key={`${searchQuery}|${locationFilter}|${slotsFilter}`}
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredGroups.length > 0 ? (
            filteredGroups.map((group) => (
              <motion.div key={group.id} variants={cardVariants}>
                <StudyGroupCard
                  group={group}
                  activeGroupId={activeGroupId}
                  currentUserId={currentUser?.id ?? null}
                  now={countdownNow}
                  onExpire={expireGroup}
                  onSelect={() => setSelectedGroupId(group.id)}
                  onJoin={handleJoinGroup}
                  onLeave={handleLeaveGroup}
                />
              </motion.div>
            ))
          ) : (
            <motion.div
              variants={cardVariants}
              className="col-span-full flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-brand-faint flex items-center justify-center mb-4">
                <Users size={28} className="text-brand-dark" />
              </div>
              <p className="text-base font-semibold text-ink">No study groups found</p>
              <p className="text-sm text-ink-muted mt-1 max-w-xs">
                {activeFilterCount > 0
                  ? "Try adjusting your search or filters."
                  : "Be the first to start a session right now!"}
              </p>
              <button
                onClick={() => { clearFilters(); setQrScanOpen(true); }}
                className="mt-5 px-5 py-2.5 bg-brand hover:bg-brand-dark text-ink font-semibold text-sm rounded-full transition-all duration-200 hover:shadow-sm"
              >
                <span className="flex items-center gap-1.5"><Plus size={14} /> Start a Session</span>
              </button>
            </motion.div>
          )}
        </motion.div>
        )}
      </div>

      {/* ── Mobile FAB ── */}
      <button
        onClick={() => setQrScanOpen(true)}
        className="fixed md:hidden bottom-6 right-6 z-20 flex items-center gap-2 px-5 py-3 bg-brand hover:bg-brand-dark text-ink font-semibold text-sm rounded-full shadow-lg hover:shadow-xl transition-all duration-200 active:scale-[0.97]"
      >
        <Plus size={17} />
        Start a Session
      </button>
    </>
  );
}

export default function FinderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg flex items-center justify-center text-ink-muted">Loading study groups...</div>}>
      <FinderPageContent />
    </Suspense>
  );
}
