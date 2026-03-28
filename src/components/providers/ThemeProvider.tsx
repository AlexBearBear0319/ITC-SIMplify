"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/*
  Theme mode = user's preference
  - auto  -> follow Singapore time rule
  - light -> force light mode
  - dark  -> force dark mode
*/
type ThemeMode = "auto" | "light" | "dark";

/*
  Resolved theme = final theme applied to the page right now
*/
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  toggleLightDark: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeMode must be used inside ThemeProvider");
  }
  return ctx;
}

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

/*
  Convert mode to final theme:
  - dark/light: direct override
  - auto: SG rule (dark from 7pm to 5:59am)
*/


function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "dark") return "dark";
  if (mode === "light") return "light";

  const hour = getSGTHour();
  return hour >= 19 || hour < 6 ? "dark" : "light";
}

/*
  Actually apply theme by toggling "dark" class on <html>.
  Your CSS tokens in globals.css already react to this class.
*/
function applyResolvedTheme(theme: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
// User's selected mode (auto/light/dark)
  const [mode, setModeState] = useState<ThemeMode>("auto");

  // Current active theme after resolving mode (light/dark)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  // Exposed setter for manual mode selection.
  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
  }, []);

  /*
    Keep interval id in ref so we can start/stop timer cleanly.
    Timer is needed only in auto mode.
  */
  const intervalRef = useRef<number | null>(null);

  /*
    Recompute final theme and apply to HTML.
    We call this on initial load, mode changes, and every minute in auto mode.
  */
  const recomputeAndApply = useCallback((currentMode: ThemeMode) => {
    const resolved = resolveTheme(currentMode);
    setResolvedTheme(resolved);
    applyResolvedTheme(resolved);
  }, []);

  /*
    Stop timer if it is running.
    Important to avoid duplicate intervals / memory leaks.
  */
  const clearAutoInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

 // Re-apply whenever mode changes
  useEffect(() => {
    clearAutoInterval();
    recomputeAndApply(mode);

    // Only auto mode needs time-based recheck
    if (mode === "auto") {
      intervalRef.current = window.setInterval(() => {
        recomputeAndApply("auto");
      }, 60_000);
    }

    return clearAutoInterval;
  }, [mode, recomputeAndApply, clearAutoInterval]);

  const toggleLightDark = useCallback(() => {
    setMode(resolveTheme(mode) === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  const value = useMemo(
    () => ({ mode, resolvedTheme, setMode, toggleLightDark }),
    [mode, resolvedTheme, setMode, toggleLightDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
