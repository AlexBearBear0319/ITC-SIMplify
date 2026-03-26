"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Bell, LogOut, AlertTriangle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
        checked ? "bg-brand-dark" : "bg-border",
      ].join(" ")}
    >
      <motion.span
        className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-surface shadow-sm"
        animate={{ x: checked ? 20 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

export default function SettingsPage() {
  const supabase = createClient();
  const router   = useRouter();

  // Preferences are UI-only for now — wire to a user_preferences table when added
  const [pushEnabled,      setPushEnabled]      = useState(true);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [logoutConfirm,    setLogoutConfirm]    = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/auth/login");
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  return (
    <div className="min-h-full bg-canvas px-4 pt-6 pb-16 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">

        <div>
          <h1 className="text-2xl font-extrabold text-ink">Settings</h1>
          <p className="text-sm text-ink-muted mt-1">Manage your preferences.</p>
        </div>

        {/* ── Preferences ── */}
        <section className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Bell size={16} className="text-ink-muted" />
            <h2 className="font-semibold text-ink">Preferences</h2>
          </div>

          <div className="divide-y divide-border">
            {(
              [
                {
                  id: "push",
                  label: "Push Notifications",
                  description: "Receive alerts for new study groups and event reminders.",
                  checked: pushEnabled,
                  onChange: setPushEnabled,
                },
                {
                  id: "reminders",
                  label: "Daily Mission Reminders",
                  description: "Get a nudge each morning to complete your daily mission.",
                  checked: remindersEnabled,
                  onChange: setRemindersEnabled,
                },
              ] as const
            ).map(({ id, label, description, checked, onChange }) => (
              <div key={id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">{label}</p>
                  <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{description}</p>
                </div>
                <Toggle checked={checked} onChange={onChange} />
              </div>
            ))}
          </div>
        </section>

        {/* ── Danger Zone ── */}
        <section className="bg-surface rounded-2xl border border-alert/30 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-alert/20 flex items-center gap-2">
            <AlertTriangle size={16} className="text-alert" />
            <h2 className="font-semibold text-alert">Danger Zone</h2>
          </div>

          <div className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink">Sign out of your account</p>
                <p className="text-xs text-ink-muted mt-0.5">
                  You will be redirected to the login page.
                </p>
              </div>

              <AnimatePresence mode="wait">
                {logoutConfirm ? (
                  <motion.div
                    key="confirm-btns"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-2 shrink-0"
                  >
                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 rounded-full bg-alert text-surface text-sm font-medium hover:bg-alert/80 active:scale-95 transition-all duration-150"
                    >
                      Yes, log out
                    </button>
                    <button
                      onClick={() => setLogoutConfirm(false)}
                      className="px-4 py-2 rounded-full border border-border text-sm text-ink-muted hover:text-ink transition-colors"
                    >
                      Cancel
                    </button>
                  </motion.div>
                ) : (
                  <motion.button
                    key="logout-btn"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => setLogoutConfirm(true)}
                    className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-full border border-alert/30 text-alert text-sm font-medium hover:bg-alert-light transition-colors duration-150"
                  >
                    <LogOut size={14} />
                    Log Out
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
