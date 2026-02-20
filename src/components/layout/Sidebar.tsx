"use client";

import { useState, useRef, useEffect } from "react";
import { Home, Clock, Users, Target, Gift, Trophy, Menu } from "lucide-react";
import Link from "next/link";

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const menuItems = [
    { icon: Home, label: "Home", href: "/" },
    { icon: Clock, label: "Timer", href: "/timer" },
    { icon: Users, label: "Study buddy", href: "/buddy" },
    { icon: Target, label: "Mission", href: "/missions" },
    { icon: Gift, label: "Rewards", href: "/rewards" },
    { icon: Trophy, label: "Leaderboard", href: "/leaderboard" },
  ];

  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node) &&
        isOpen
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 z-30 md:hidden" onClick={() => setIsOpen(false)} />
      )}

      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md border border-gray-200"
      >
        <Menu size={24} className="text-gray-700" />
      </button>

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`
          fixed top-0 left-0 h-screen bg-white border-r border-gray-200 z-40 
          transition-transform duration-300 ease-in-out
          w-52 flex flex-col
          ${isOpen ? "translate-x-0" : "-translate-x-full"} 
          md:translate-x-0
        `}
      >
        {/* Logo */}
        <div className="px-4 h-16 border-b border-gray-200 flex items-center">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center">
              <span className="text-sm font-bold">S</span>
            </div>
            <span className="font-bold text-lg">SIMplify</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <item.icon size={20} />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
