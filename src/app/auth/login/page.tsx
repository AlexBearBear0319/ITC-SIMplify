"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { loginAction, signUpAction } from "@/app/auth/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type FormMode = "login" | "signup";

type ActionResult =
  | { success: true; message?: string }
  | { error: string; fieldErrors?: Record<string, string>; usernameSuggestions?: string[] }
  | null;

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function Spinner() {
  return <span className="inline-block w-4 h-4 border-2 border-ink/30 border-t-ink rounded-full animate-spin" />;
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-1.5 text-xs text-alert mt-1.5"
    >
      <AlertCircle size={12} className="shrink-0" />
      {msg}
    </motion.p>
  );
}

function PasswordInput({
  id, name, label, autoComplete, placeholder, error,
}: {
  id: string; name: string; label: string;
  autoComplete: string; placeholder?: string; error?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink mb-1.5">{label}</label>
      <div className="relative">
        <input
          id={id} name={name}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder ?? "••••••••"}
          className={`w-full px-4 py-2.5 pr-11 rounded-xl border bg-canvas text-ink text-sm placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand transition-shadow ${error ? "border-alert" : "border-border"}`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted transition-colors"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <FieldError msg={error} />
    </div>
  );
}

// ─── Login sub-form ───────────────────────────────────────────────────────────

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(loginAction, null);

  useEffect(() => {
    if (state && "success" in state && state.success) onSuccess();
  }, [state, onSuccess]);

  const fe = (state && "fieldErrors" in state ? state.fieldErrors : {}) ?? {};

  return (
    <form action={action} className="space-y-4">
      {/* Email */}
      <div>
        <label htmlFor="login-email" className="block text-sm font-medium text-ink mb-1.5">Email</label>
        <input
          id="login-email" name="email" type="email" autoComplete="email"
          placeholder="your.email@example.com" required
          className={`w-full px-4 py-2.5 rounded-xl border bg-canvas text-ink text-sm placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand transition-shadow ${fe.email ? "border-alert" : "border-border"}`}
        />
        <FieldError msg={fe.email} />
      </div>

      {/* Password */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="login-password" className="block text-sm font-medium text-ink">Password</label>
          <Link href="/auth/forgot-password" className="text-xs text-ink-muted hover:text-ink transition-colors">
            Forgot Password?
          </Link>
        </div>
        <PasswordInput id="login-password" name="password" label="" autoComplete="current-password" error={fe.password} />
      </div>

      {/* Global error */}
      <AnimatePresence>
        {state && "error" in state && !Object.keys(fe).length && (
          <motion.p
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-xs text-alert bg-alert-light rounded-xl px-4 py-2.5"
          >
            <AlertCircle size={14} className="shrink-0" /> {state.error}
          </motion.p>
        )}
      </AnimatePresence>

      <button
        type="submit" disabled={pending}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-brand text-ink font-semibold text-sm hover:bg-brand-dark active:scale-95 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {pending ? <Spinner /> : <><span>Sign In</span><ArrowRight size={15} /></>}
      </button>
    </form>
  );
}

// ─── Sign-Up sub-form ─────────────────────────────────────────────────────────

function SignUpForm({ onSuccess }: { onSuccess: (msg: string) => void }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(signUpAction, null);
  const [username, setUsername] = useState("");

  useEffect(() => {
    if (state && "success" in state && state.success) {
      onSuccess(state.message ?? "Account created! Check your email.");
    }
  }, [state, onSuccess]);

  const fe = (state && "fieldErrors" in state ? state.fieldErrors : {}) ?? {};
  const suggestions = (state && "usernameSuggestions" in state ? state.usernameSuggestions : null) ?? null;

  return (
    <form action={action} className="space-y-4">
      {/* Email */}
      <div>
        <label htmlFor="signup-email" className="block text-sm font-medium text-ink mb-1.5">Email</label>
        <input
          id="signup-email" name="email" type="email" autoComplete="email"
          placeholder="your.email@example.com" required
          className={`w-full px-4 py-2.5 rounded-xl border bg-canvas text-ink text-sm placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand transition-shadow ${fe.email ? "border-alert" : "border-border"}`}
        />
        <FieldError msg={fe.email} />
      </div>

      {/* Username */}
      <div>
        <label htmlFor="signup-username" className="block text-sm font-medium text-ink mb-1.5">Username</label>
        <input
          id="signup-username" name="username" type="text" autoComplete="username"
          placeholder="alexvun" required minLength={3}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={`w-full px-4 py-2.5 rounded-xl border bg-canvas text-ink text-sm placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand transition-shadow ${fe.username ? "border-alert" : "border-border"}`}
        />
        <FieldError msg={fe.username} />
        <AnimatePresence>
          {suggestions && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-2"
            >
              <p className="text-[11px] text-ink-faint mb-1.5">Try one of these:</p>
              <div className="flex gap-2 flex-wrap">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setUsername(s)}
                    className="text-xs px-3 py-1 rounded-lg bg-brand/10 text-brand-dark hover:bg-brand/25 active:scale-95 transition-all duration-150 font-medium"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Password */}
      <PasswordInput
        id="signup-password" name="password" label="Password"
        autoComplete="new-password" error={fe.password}
      />
      <p className="text-[11px] text-ink-faint -mt-2">
        Min. 8 characters, 1 uppercase letter, 1 number.
      </p>

      {/* Confirm Password */}
      <PasswordInput
        id="signup-confirm" name="confirmPassword" label="Confirm Password"
        autoComplete="new-password" placeholder="••••••••" error={fe.confirmPassword}
      />

      {/* Global error */}
      <AnimatePresence>
        {state && "error" in state && !Object.keys(fe).length && (
          <motion.p
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-xs text-alert bg-alert-light rounded-xl px-4 py-2.5"
          >
            <AlertCircle size={14} className="shrink-0" /> {state.error}
          </motion.p>
        )}
      </AnimatePresence>

      <button
        type="submit" disabled={pending}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-brand text-ink font-semibold text-sm hover:bg-brand-dark active:scale-95 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {pending ? <Spinner /> : <><span>Create Account</span><ArrowRight size={15} /></>}
      </button>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkError = searchParams.get("error");
  const [mode, setMode] = useState<FormMode>("login");
  const [signupSuccess, setSignupSuccess] = useState<string | null>(null);

  function switchMode(next: FormMode) {
    setMode(next);
    setSignupSuccess(null);
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center p-6">
      {/* Ambient blobs */}
      <div className="pointer-events-none fixed top-0 left-0 w-[500px] h-[500px] rounded-full bg-brand opacity-20 blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="pointer-events-none fixed bottom-0 right-0 w-96 h-96 rounded-full bg-gold opacity-10 blur-3xl translate-x-1/4 translate-y-1/4" />

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
        className="relative w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center shadow-md mb-4">
            <Sparkles size={26} className="text-ink" strokeWidth={2.2} />
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}
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

        {/* Invalid/expired reset link banner */}
        <AnimatePresence>
          {linkError === "invalid_or_expired_link" && (
            <motion.p
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-xs text-alert bg-alert-light rounded-xl px-4 py-2.5 mb-4"
            >
              <AlertCircle size={14} className="shrink-0" />
              That reset link has expired or is invalid. Please request a new one.
            </motion.p>
          )}
        </AnimatePresence>

        {/* Card */}
        <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">

          {/* Sign-up success state */}
          <AnimatePresence>
            {signupSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center text-center py-4 gap-3"
              >
                <div className="w-12 h-12 rounded-full bg-success-light flex items-center justify-center">
                  <CheckCircle2 size={24} className="text-success" />
                </div>
                <p className="text-sm font-semibold text-ink">Almost there!</p>
                <p className="text-xs text-ink-muted leading-relaxed">{signupSuccess}</p>
                <button
                  onClick={() => switchMode("login")}
                  className="mt-1 text-xs font-semibold text-brand-dark hover:text-ink transition-colors"
                >
                  Back to Sign In
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {!signupSuccess && (
            <>
              {/* Tab switcher */}
              <div className="flex bg-canvas rounded-xl p-1 mb-5 gap-1">
                {(["login", "signup"] as FormMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                      mode === m
                        ? "bg-surface text-ink shadow-sm"
                        : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {m === "login" ? "Sign In" : "Sign Up"}
                  </button>
                ))}
              </div>

              {/* Forms animate between modes */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, x: mode === "login" ? -12 : 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: mode === "login" ? 12 : -12 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                >
                  {mode === "login" ? (
                    <LoginForm onSuccess={() => { router.refresh(); router.push("/"); }} />
                  ) : (
                    <SignUpForm onSuccess={(msg) => setSignupSuccess(msg)} />
                  )}
                </motion.div>
              </AnimatePresence>
            </>
          )}
        </div>

        <p className="text-center text-xs text-ink-faint mt-6">
          SIM IT Club · SIMplify {new Date().getFullYear()}
        </p>
      </motion.div>
    </div>
  );
}
