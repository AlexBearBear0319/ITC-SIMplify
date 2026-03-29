"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type SidebarProfile = {
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  points: number;
};
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Gift,
  Trophy,
  UserCircle,
  Settings,
  Menu,
  X,
  MapPin,
} from "lucide-react";

const NAV_MAIN = [
  { icon: LayoutDashboard, label: "Dashboard",   href: "/" },
  { icon: Users,           label: "Study Buddy", href: "/finder" },
  { icon: CalendarDays,    label: "Events",      href: "/events" },
  { icon: Gift,            label: "Rewards",     href: "/rewards" },
  { icon: Trophy,          label: "Leaderboard", href: "/leaderboard" },
];

const NAV_BOTTOM = [
  { icon: UserCircle, label: "Profile",  href: "/profile" },
  { icon: Settings,   label: "Settings", href: "/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState<SidebarProfile | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside the panel on mobile
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        isOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Auto-close on navigation
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Fetch user profile — re-runs on navigation and when Settings dispatches 'profile-updated'
  const fetchProfile = () => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("username, full_name, avatar_url, points")
        .eq("id", user.id)
        .single()
        .then(({ data }) => { if (data) setProfile(data as SidebarProfile); });
    });
  };

  useEffect(() => { fetchProfile(); }, [pathname]);

  useEffect(() => {
    window.addEventListener("profile-updated", fetchProfile);
    return () => window.removeEventListener("profile-updated", fetchProfile);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-overlay/20 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/*
        Mobile hamburger — only rendered when the drawer is CLOSED.
        Once the sidebar is open, the X lives inside the panel header,
        so there is zero overlap between the two buttons.
      */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open navigation"
          className="fixed top-4 left-4 z-50 md:hidden p-2 bg-surface rounded-xl shadow-sm border border-border dark:border-slate-700 text-ink-muted hover:text-ink transition-colors duration-200"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Sidebar panel */}
      <aside
        ref={sidebarRef}
        className={`
          fixed top-0 left-0 h-screen w-64 z-40
          bg-surface border-r border-border          flex flex-col
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
      >
        {/* ── Logo row — X button lives here on mobile ── */}
        <div className="px-5 h-16 border-b border-border dark:border-slate-700 flex items-center shrink-0">
          <Link href="/" className="flex items-center gap-3 group flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-200 shrink-0">
              <MapPin size={17} className="text-ink" strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[15px] text-ink tracking-tight leading-none">
                SIMplify
              </p>
              <p className="text-[10px] text-ink-faint mt-0.5 leading-none">
                IT Club · SIM UOW
              </p>
            </div>
          </Link>

          {/* Close button — mobile only, inside the panel so it never overlaps content */}
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close navigation"
            className="md:hidden shrink-0 ml-2 p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-brand-faint transition-colors duration-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Main navigation ── */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
          <p className="px-3 mb-2 text-[10px] font-semibold text-ink-faint uppercase tracking-widest">
            Navigate
          </p>

          {NAV_MAIN.map(({ icon: Icon, label, href }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-200
                  ${
                    active
                      ? "bg-brand text-ink shadow-sm"
                      : "text-ink-muted hover:bg-brand-faint hover:text-ink"
                  }
                `}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 2} className="shrink-0" />
                <span className="flex-1">{label}</span>
                {active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-dark shrink-0" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── Divider ── */}
        <div className="mx-4 border-t border-border dark:border-slate-700" />

        {/* ── Profile + Settings ── */}
        <div className="px-3 py-3 space-y-0.5">
          {NAV_BOTTOM.map(({ icon: Icon, label, href }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-200
                  ${
                    active
                      ? "bg-brand text-ink shadow-sm"
                      : "text-ink-muted hover:bg-brand-faint hover:text-ink"
                  }
                `}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 2} className="shrink-0" />
                <span className="flex-1">{label}</span>
                {active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-dark shrink-0" />
                )}
              </Link>
            );
          })}
        </div>

        {/* ── User strip ── */}
        <div className="px-4 py-3 border-t border-border dark:border-slate-700 shrink-0">
          <Link
            href="/profile"
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-brand-faint transition-colors duration-200 group"
          >
            <div className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center text-sm font-bold text-ink shrink-0 group-hover:ring-2 group-hover:ring-brand transition-all duration-200 overflow-hidden">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
              ) : (
                (profile?.full_name || profile?.username)?.slice(0, 2).toUpperCase() ?? "…"
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink truncate leading-tight">
                {profile?.full_name || profile?.username || "Loading…"}
              </p>
              <p className="text-xs text-gold font-medium leading-tight mt-0.5">
                ✦ {profile?.points.toLocaleString() ?? "—"} pts
              </p>
            </div>
          </Link>
        </div>
      </aside>
    </>
  );
}
