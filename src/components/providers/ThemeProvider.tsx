"use client";

import { useEffect } from "react";

/**
 * Returns the current hour (0-23) in Singapore Time (SGT / Asia/Singapore).
 * Uses the Intl API — works in all modern browsers without any external deps.
 */
function getSGTHour(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Singapore",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "12";
  // "24" is returned at midnight by some engines; normalise to 0
  return parseInt(hourStr, 10) % 24;
}

/**
 * Dark mode: 7 PM – 5:59 AM SGT  (hour >= 19 || hour < 6)
 * Light mode: 6 AM – 6:59 PM SGT (hour >= 6  && hour < 19)
 */
function applyTheme() {
  const hour = getSGTHour();
  const isDark = hour >= 19 || hour < 6;
  document.documentElement.classList.toggle("dark", isDark);
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Apply immediately on mount
    applyTheme();

    // Re-check every minute so a student studying at 7 PM sees the switch live
    const interval = setInterval(applyTheme, 60_000);
    return () => clearInterval(interval);
  }, []);

  return <>{children}</>;
}
