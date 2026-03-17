"use client";

/**
 * Login / Sign-up — /auth/login
 *
 * Supabase wiring (swap in when ready):
 *
 *   Sign in:
 *     const { error } = await supabase.auth.signInWithPassword({ email, password });
 *     if (error) throw error;
 *     router.push("/");
 *
 *   Sign up:
 *     const { error } = await supabase.auth.signUp({
 *       email,
 *       password,
 *       options: { data: { full_name: fullName } },
 *     });
 *     if (error) throw error;
 *     // Show "check your email" message or redirect
 *
 *   Session guard (server component or middleware):
 *     const { data: { session } } = await supabase.auth.getSession();
 *     if (session) redirect("/");
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Sparkles, Eye, EyeOff, ArrowRight } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type FormMode = "login" | "signup";

// ─────────────────────────────────────────────
// Spinner  (pure CSS, no extra deps)
// ─────────────────────────────────────────────

function Spinner() {
  return (
    <span className="inline-block w-4 h-4 border-2 border-ink/30 border-t-ink rounded-full animate-spin" />
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode]                   = useState<FormMode>("login");
  const [email, setEmail]                 = useState("");
  const [password, setPassword]           = useState("");
  const [fullName, setFullName]           = useState("");          // sign-up only
  const [showPassword, setShowPassword]   = useState(false);
  const [isLoading, setIsLoading]         = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  function switchMode(next: FormMode) {
    setMode(next);
    setError(null);
    setPassword("");
    setShowPassword(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createClient();

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
      }
      // router.refresh() forces the Next.js router to re-fetch server data with
      // the newly written auth cookies so middleware sees the session immediately.
      // Without this, the redirect lands on a page that still looks like a guest.
      router.refresh();
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center p-6">

      {/* ── Ambient background blobs ── */}
      <div className="pointer-events-none fixed top-0 left-0 w-[500px] h-[500px] rounded-full bg-brand opacity-20 blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="pointer-events-none fixed bottom-0 right-0 w-96 h-96 rounded-full bg-gold opacity-10 blur-3xl translate-x-1/4 translate-y-1/4" />

      {/* ── Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.5,
          ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
        }}
        className="relative w-full max-w-sm"
      >
        {/* Logo mark */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center shadow-md mb-4">
            <Sparkles size={26} className="text-ink" strokeWidth={2.2} />
          </div>

          {/* Heading — fades when mode switches */}
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="text-center"
            >
              <h1 className="text-2xl font-extrabold text-ink leading-tight">
                {mode === "login" ? "Welcome back!" : "Join SIMplify"}
              </h1>
              <p className="text-sm text-ink-muted mt-1.5 max-w-xs">
                {mode === "login"
                  ? "Sign in to find your perfect study spot and earn rewards."
                  : "Create your account and start discovering study spaces."}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Form card */}
        <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Full Name — sign-up only, animates in/out */}
            <AnimatePresence initial={false}>
              {mode === "signup" && (
                <motion.div
                  key="fullName"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
                  className="overflow-hidden"
                >
                  <div className="pb-4">
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
                      required={mode === "signup"}
                      autoComplete="name"
                      placeholder="Alex Vun"
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-canvas text-ink text-sm placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand transition-shadow"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="your.email@example.com"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-canvas text-ink text-sm placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand transition-shadow"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-11 rounded-xl border border-border bg-canvas text-ink text-sm placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand transition-shadow"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error message */}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-alert bg-alert-light rounded-xl px-4 py-2.5 leading-relaxed"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-brand text-ink font-semibold text-sm hover:bg-brand-dark active:scale-95 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Spinner />
              ) : (
                <>
                  {mode === "login" ? "Sign In" : "Create Account"}
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Mode toggle */}
          <div className="mt-5 pt-4 border-t border-border text-center">
            <p className="text-sm text-ink-muted">
              {mode === "login"
                ? "Don't have an account?"
                : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => switchMode(mode === "login" ? "signup" : "login")}
                className="font-semibold text-ink hover:text-brand-dark transition-colors"
              >
                {mode === "login" ? "Sign Up" : "Sign In"}
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-ink-faint mt-6">
          SIM IT Club · SIMplify {new Date().getFullYear()}
        </p>
      </motion.div>
    </div>
  );
}
