"use client";

import { useState, useRef, useEffect } from "react";
import { User, ChevronDown, BarChart3, Settings } from "lucide-react";
import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/": "Homepage",
  "/timer": "Timer",
  "/study-buddy": "Study Buddy",
  "/mission": "Mission",
  "/rewards": "Rewards",
  "/leaderboard": "Leaderboard",
  "/profile": "Profile",
  "/statistics": "Statistics",
  "/settings": "Settings",
};

export default function Header() {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "SIMplify";

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node) &&
        showProfileMenu
      ) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showProfileMenu]);

  return (
    <header className="bg-white border-b border-gray-200 px-4 md:px-6 h-16 flex items-center justify-between sticky top-0 z-20">
      <div className="min-w-0 shrink pl-12 md:pl-0">
        <h1 className="text-lg md:text-xl font-bold text-gray-800 truncate">{title}</h1>
      </div>

      {/* Profile Button */}
      <div className="relative shrink-0" ref={profileRef}>
        <button
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          className="flex items-center gap-2 md:gap-3 px-2 md:px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
            <User size={18} className="text-gray-600" />
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-semibold text-gray-800">Student Name</p>
            <p className="text-xs text-green-600">1,200 pts</p>
          </div>
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform ${showProfileMenu ? "rotate-180" : ""}`}
          />
        </button>

        {/* Profile Dropdown */}
        {showProfileMenu && (
          <div className="absolute top-full right-0 mt-2 w-48 py-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            <a
              href="/profile"
              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
            >
              <User size={18} className="text-gray-600" />
              <span className="text-sm text-gray-700">Profile</span>
            </a>
            <a
              href="/statistics"
              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
            >
              <BarChart3 size={18} className="text-gray-600" />
              <span className="text-sm text-gray-700">Statistics</span>
            </a>
            <a
              href="/settings"
              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
            >
              <Settings size={18} className="text-gray-600" />
              <span className="text-sm text-gray-700">Settings</span>
            </a>
          </div>
        )}
      </div>
    </header>
  );
}
