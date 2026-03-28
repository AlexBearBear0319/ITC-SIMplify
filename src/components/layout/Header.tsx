"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { UserCircle, Settings, ChevronDown, Coins, LogOut, ShieldCheck } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type UserProfile = {
  username: string;
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

  // Resolve title – match prefix for dynamic routes like /location/[id]
  const title =
    PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES).find(([key]) => key !== "/" && pathname.startsWith(key))?.[1] ??
    "SIMplify";

  // Fetch real profile on mount
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("username, avatar_url, points, is_admin")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data) setProfile(data as UserProfile);
        });
    });
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

  const initials = profile?.username
    ? profile.username.slice(0, 2).toUpperCase()
    : "…";

  return (
    <header className="sticky top-0 z-20 h-16 bg-surface/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 md:px-6 shrink-0">
      {/* Page title – offset on mobile for hamburger */}
      <h1 className="text-base md:text-lg font-bold text-ink pl-10 md:pl-0 truncate">
        {title}
      </h1>

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
              {profile?.username ?? "…"}
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
                {profile?.username ?? "Loading…"}
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
    </header>
  );
}
