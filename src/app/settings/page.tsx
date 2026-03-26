"use client";

/**
 * Settings — /settings
 *
 * Profile Settings: loads full_name from `profiles`, email from Supabase Auth.
 *   Saves full_name → profiles table, email → supabase.auth.updateUser()
 *   (email change sends a confirmation link to the new address)
 *
 * Preferences: push_notifications / daily_reminders are local UI state only.
 *   No `user_preferences` table exists yet — wire up when the table is added.
 *
 * Danger Zone: calls supabase.auth.signOut() then redirects to /auth/login.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  User,
  Bell,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

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

type SaveState = "idle" | "saving" | "saved" | "error";

export default function SettingsPage() {
  const supabase = createClient();
  const router   = useRouter();

  const [loading,  setLoading]  = useState(true);
  const [fullName, setFullName] = useState("");
  const [email,    setEmail]    = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Preferences — local UI state (no user_preferences table yet)
  const [pushEnabled,      setPushEnabled]      = useState(true);
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  const [logoutConfirm,  setLogoutConfirm]  = useState(false);
  const [deleteConfirm,  setDeleteConfirm]  = useState(false);
  const [deleteError,    setDeleteError]    = useState<string | null>(null);

  // ── Load profile on mount ──
  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      setFullName(profile?.full_name ?? "");
      setEmail(user.email ?? "");
      setLoading(false);
    }
    loadProfile();
  }, []);

  // ── Save profile changes ──
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveState("saving");
    setSaveError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Save full_name to profiles table
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", user.id);

    if (profileError) {
      setSaveState("error");
      setSaveError(profileError.message);
      return;
    }

    // 2. Update email in Supabase Auth if it changed
    //    (Supabase will send a confirmation link to the new address)
    if (email !== user.email) {
      const { error: emailError } = await supabase.auth.updateUser({ email });
      if (emailError) {
        setSaveState("error");
        setSaveError(emailError.message);
        return;
      }
    }

    setSaveState("saved");
    window.dispatchEvent(new Event("profile-updated"));
    setTimeout(() => setSaveState("idle"), 2500);
  }

  // ── Sign out ──
  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  // ── Delete account ──
  async function handleDeleteAccount() {
    setDeleteError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", user.id);

    if (error) {
      setDeleteError(error.message);
      setDeleteConfirm(false);
      return;
    }

    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="min-h-full bg-canvas px-4 pt-6 pb-16 sm:px-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="space-y-1">
            <div className="h-7 w-32 rounded-lg bg-canvas animate-pulse" />
            <div className="h-4 w-56 rounded-lg bg-canvas animate-pulse" />
          </div>
          <div className="h-52 rounded-2xl bg-canvas animate-pulse" />
          <div className="h-36 rounded-2xl bg-canvas animate-pulse" />
          <div className="h-24 rounded-2xl bg-canvas animate-pulse" />
        </div>
      </div>
    );
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
              <p className="text-xs text-ink-faint mt-1">
                Changing your email will send a confirmation link to the new address.
              </p>
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
                    key="saved"
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 text-success text-sm"
                  >
                    <CheckCircle2 size={15} />
                    <span>Saved!</span>
                  </motion.div>
                )}
                {saveState === "error" && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 text-alert text-sm"
                  >
                    <XCircle size={15} />
                    <span>{saveError ?? "Failed to save."}</span>
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

          <div className="p-5 space-y-5">
            {/* Sign out row */}
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

            {/* Delete account row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-4 border-t border-alert/20">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-alert">Delete Account</p>
                <p className="text-xs text-ink-muted mt-0.5">
                  Permanently removes your profile and all data. This cannot be undone.
                </p>
                {deleteError && (
                  <p className="text-xs text-alert mt-1">{deleteError}</p>
                )}
              </div>

              <AnimatePresence mode="wait">
                {deleteConfirm ? (
                  <motion.div
                    key="delete-confirm"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-2 shrink-0"
                  >
                    <button
                      onClick={handleDeleteAccount}
                      className="px-4 py-2 rounded-full bg-alert text-surface text-sm font-medium hover:bg-alert/80 active:scale-95 transition-all duration-150"
                    >
                      Yes, delete
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="px-4 py-2 rounded-full border border-border text-sm text-ink-muted hover:text-ink transition-colors"
                    >
                      Cancel
                    </button>
                  </motion.div>
                ) : (
                  <motion.button
                    key="delete-btn"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => setDeleteConfirm(true)}
                    className="shrink-0 px-4 py-2 rounded-full border border-alert/30 text-alert text-sm font-medium hover:bg-alert-light transition-colors duration-150"
                  >
                    Delete Account
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
