"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { UserCircle, Settings, ChevronDown, Coins, LogOut, ShieldCheck, Monitor, Sun, Moon,} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useThemeMode } from "@/components/providers/ThemeProvider";

type UserProfile = {
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  points: number;
  is_admin: boolean;
};

const PAGE_TITLES: Record<string, string> = {
  "/":            "Dashboard",
  "/location":    "Locations",
  "/finder":      "Study Buddy",
  "/events":      "Events",
  "/rewards":     "Rewards",
  "/leaderboard": "Leaderboard",
  "/profile/rewards": "My Rewards",
  "/profile":     "Profile",
  "/settings":    "Settings",
  "/admin":       "Admin Panel",
};

export default function Header() {
  const pathname = usePathname();
  const router   = useRouter();
  const [open, setOpen]       = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Theme controls from provider:
  // - mode = "auto" | "light" | "dark"
  // - resolvedTheme = actual applied theme ("light" | "dark")
  // - setMode = updates theme mode
  const { mode, resolvedTheme, setMode } = useThemeMode();

  // Resolve title – match prefix for dynamic routes like /location/[id]
  const title =
    PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES).find(([key]) => key !== "/" && pathname.startsWith(key))?.[1] ??
    "SIMplify";

  // Fetch real profile — re-runs on navigation and when Settings dispatches 'profile-updated'
  const fetchProfile = () => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("username, full_name, avatar_url, points, is_admin")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data) setProfile(data as UserProfile);
        });
    });
  };

  useEffect(() => { fetchProfile(); }, [pathname]);

  useEffect(() => {
    window.addEventListener("profile-updated", fetchProfile);
    return () => window.removeEventListener("profile-updated", fetchProfile);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  const handleLogOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  };

  const displayName = profile?.full_name || profile?.username || null;
  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : "…";

  // Shared classes for theme mode buttons
  const themeButtonBase =
    "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] border transition-colors duration-200";
  const themeButtonActive = "bg-brand text-ink border-brand";
  const themeButtonIdle =
    "bg-surface text-ink-muted border-border hover:bg-brand-faint hover:text-ink";

  return (
    <header className="sticky top-0 z-20 h-16 bg-surface/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 md:px-6 shrink-0">
      {/* Page title – offset on mobile for hamburger */}
      <h1 className="text-base md:text-lg font-bold text-ink pl-10 md:pl-0 truncate">
        {title}
      </h1>

 {/* Right side controls: theme switch + profile */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Header-only theme switch (no separate component file).
            Hidden on very small screens to keep header uncluttered. */}
        {/* Mobile: single cycle button (auto → light → dark → auto) */}
        <button
          type="button"
          onClick={() => setMode(mode === "auto" ? "light" : mode === "light" ? "dark" : "auto")}
          title={`Theme: ${mode} (tap to cycle)`}
          className="md:hidden inline-flex items-center justify-center w-8 h-8 rounded-full border border-border bg-surface text-ink-muted hover:bg-brand-faint hover:text-ink transition-colors duration-200"
        >
          {mode === "auto" ? <Monitor size={14} /> : mode === "light" ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <div className="hidden md:flex items-center gap-1">
          {/* Auto mode = follow SG timing in ThemeProvider */}
          <button
            type="button"
            onClick={() => setMode("auto")}
            aria-pressed={mode === "auto"}
            title={`Auto mode (SGT). Current: ${resolvedTheme}`}
            className={`${themeButtonBase} ${mode === "auto" ? themeButtonActive : themeButtonIdle}`}
          >
            <Monitor size={12} />
            Auto
          </button>
  

          {/* Force light mode */}
          <button
            type="button"
            onClick={() => setMode("light")}
            aria-pressed={mode === "light"}
            title="Force light mode"
            className={`${themeButtonBase} ${mode === "light" ? themeButtonActive : themeButtonIdle}`}
          >
            <Sun size={12} />
            Light
          </button>

{/* Force dark mode */}
          <button
            type="button"
            onClick={() => setMode("dark")}
            aria-pressed={mode === "dark"}
            title="Force dark mode"
            className={`${themeButtonBase} ${mode === "dark" ? themeButtonActive : themeButtonIdle}`}
          >
            <Moon size={12} />
            Dark
          </button>
        </div>


      {/* Profile button */}
      <div className="relative shrink-0" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-3 py-1.5 bg-canvas border border-border rounded-full hover:bg-brand-faint transition-colors duration-200"
        >
          {/* Avatar */}
          <div className="w-7 h-7 rounded-full bg-brand-light flex items-center justify-center text-xs font-bold text-ink shrink-0 overflow-hidden">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="hidden sm:flex flex-col items-start leading-none">
            <span className="text-xs font-semibold text-ink">
              {displayName ?? "…"}
            </span>
            <span className="text-[10px] text-gold font-medium mt-0.5">
              ✦ {profile ? profile.points.toLocaleString() : "—"} pts
            </span>
          </div>
          <ChevronDown
            size={14}
            className={`text-ink-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute top-full right-0 mt-2 w-52 bg-surface border border-border rounded-2xl shadow-md py-1.5 overflow-hidden">
            <div className="px-4 py-2 border-b border-border mb-1">
              <p className="text-sm font-semibold text-ink">
                {displayName ?? "Loading…"}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <Coins size={12} className="text-gold" />
                <span className="text-xs text-gold font-medium">
                  {profile ? profile.points.toLocaleString() : "—"} points
                </span>
              </div>
            </div>

            <Link
              href="/profile"
              className="flex items-center gap-3 px-4 py-2 text-sm text-ink-muted hover:text-ink hover:bg-brand-faint transition-colors duration-150"
            >
              <UserCircle size={16} />
              <span>Profile</span>
            </Link>

            {profile?.is_admin && (
              <Link
                href="/admin"
                className="flex items-center gap-3 px-4 py-2 text-sm text-ink-muted hover:text-ink hover:bg-brand-faint transition-colors duration-150"
              >
                <ShieldCheck size={16} />
                <span>Admin Panel</span>
              </Link>
            )}

            <Link
              href="/settings"
              className="flex items-center gap-3 px-4 py-2 text-sm text-ink-muted hover:text-ink hover:bg-brand-faint transition-colors duration-150"
            >
              <Settings size={16} />
              <span>Settings</span>
            </Link>

            <div className="border-t border-border mt-1 pt-1">
              <button
                onClick={handleLogOut}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-alert hover:bg-alert-light transition-colors duration-150"
              >
                <LogOut size={16} />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </header>
  );
}
