"use client";

import { useActionState, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { resetPasswordAction } from "@/app/auth/actions";

type ActionResult =
  | { success: true; message?: string }
  | { error: string; fieldErrors?: Record<string, string> }
  | null;

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
  id, name, label, autoComplete, error,
}: {
  id: string; name: string; label: string; autoComplete: string; error?: string;
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
          placeholder="••••••••"
          required
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

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState<ActionResult, FormData>(resetPasswordAction, null);

  const fe = (state && "fieldErrors" in state ? state.fieldErrors : {}) ?? {};
  const isSuccess = state && "success" in state && state.success;

  useEffect(() => {
    if (isSuccess) {
      const t = setTimeout(() => {
        window.location.href = "/auth/login";
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [isSuccess]);

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
          <div className="text-center">
            <h1 className="text-2xl font-extrabold text-ink leading-tight">Set New Password</h1>
            <p className="text-sm text-ink-muted mt-1.5 max-w-xs">
              Choose a strong password for your account.
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center text-center py-4 gap-3"
              >
                <div className="w-12 h-12 rounded-full bg-success-light flex items-center justify-center">
                  <CheckCircle2 size={24} className="text-success" />
                </div>
                <p className="text-sm font-semibold text-ink">Password updated!</p>
                <p className="text-xs text-ink-muted leading-relaxed">
                  {(state as { success: true; message?: string }).message}
                </p>
                <p className="text-[11px] text-ink-faint">Redirecting to sign in…</p>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                action={action}
                className="space-y-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <PasswordInput
                  id="password" name="password" label="New Password"
                  autoComplete="new-password" error={fe.password}
                />
                <p className="text-[11px] text-ink-faint -mt-2">
                  Min. 8 characters, 1 uppercase letter, 1 number.
                </p>

                <PasswordInput
                  id="confirmPassword" name="confirmPassword" label="Confirm New Password"
                  autoComplete="new-password" error={fe.confirmPassword}
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
                  type="submit"
                  disabled={pending}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-brand text-ink font-semibold text-sm hover:bg-brand-dark active:scale-95 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {pending ? <Spinner /> : <><span>Update Password</span><ArrowRight size={15} /></>}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-xs text-ink-faint mt-6">
          SIM IT Club · SIMplify {new Date().getFullYear()}
        </p>
      </motion.div>
    </div>
  );
}
