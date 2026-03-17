"use client";

/**
 * Settings — /settings
 *
 * Supabase wiring:
 *   For saving profile changes:
 *     const { error } = await supabase
 *       .from("profiles")
 *       .update({ full_name: fullName, email })
 *       .eq("id", session.user.id);
 *
 *   For updating notification preferences:
 *     const { error } = await supabase
 *       .from("user_preferences")
 *       .upsert({
 *         user_id: session.user.id,
 *         push_notifications: pushEnabled,
 *         daily_reminders: remindersEnabled,
 *       });
 *
 *   For logout:
 *     const { error } = await supabase.auth.signOut();
 *     router.push("/auth/login");
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  User,
  Bell,
  LogOut,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

// ─────────────────────────────────────────────
// Toggle  (accessible switch button)
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved";

export default function SettingsPage() {
  // TODO: Initialise from supabase.from("profiles").select("full_name, email").eq("id", userId).single()
  const [fullName, setFullName]   = useState("Alex Vun");
  const [email, setEmail]         = useState("alex.vun@sit.singaporetech.edu.sg");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // TODO: Initialise from supabase.from("user_preferences").select("push_notifications, daily_reminders").eq("user_id", userId).single()
  const [pushEnabled,      setPushEnabled]      = useState(true);
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const router = useRouter();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveState("saving");
    // TODO: await supabase.from("profiles").update({ full_name: fullName, email }).eq("id", userId);
    await new Promise((r) => setTimeout(r, 600)); // simulated network delay
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 2500);
  }

  async function handleLogout() {
    // TODO: const { error } = await supabase.auth.signOut();
    router.push("/auth/login");
  }

  return (
    <div className="min-h-full bg-canvas px-4 pt-6 pb-16 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Settings</h1>
          <p className="text-sm text-ink-muted mt-1">
            Manage your profile and preferences.
          </p>
        </div>

        {/* ── Profile Settings ── */}
        <section className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <User size={16} className="text-ink-muted" />
            <h2 className="font-semibold text-ink">Profile Settings</h2>
          </div>

          <form onSubmit={handleSave} className="p-5 space-y-4">
            {/* Full Name */}
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-ink mb-1.5"
              >
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-canvas text-ink text-sm placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand transition-shadow"
                placeholder="Your full name"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-ink mb-1.5"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-canvas text-ink text-sm placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand transition-shadow"
                placeholder="your.email@example.com"
              />
            </div>

            {/* Save */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={saveState === "saving"}
                className="px-5 py-2.5 rounded-full bg-ink text-surface text-sm font-medium hover:bg-ink/80 active:scale-95 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saveState === "saving" ? "Saving…" : "Save Changes"}
              </button>

              <AnimatePresence>
                {saveState === "saved" && (
                  <motion.div
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 text-success text-sm"
                  >
                    <CheckCircle2 size={15} />
                    <span>Saved!</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </form>
        </section>

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
                  description:
                    "Receive alerts for new study groups and event reminders.",
                  checked: pushEnabled,
                  onChange: setPushEnabled,
                },
                {
                  id: "reminders",
                  label: "Daily Mission Reminders",
                  description:
                    "Get a nudge each morning to complete your daily mission.",
                  checked: remindersEnabled,
                  onChange: setRemindersEnabled,
                },
              ] as const
            ).map(({ id, label, description, checked, onChange }) => (
              <div key={id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">{label}</p>
                  <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">
                    {description}
                  </p>
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
