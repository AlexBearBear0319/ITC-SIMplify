"use server";

import { createClient } from "@/utils/supabase/server";
import {
  loginSchema,
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/auth/schemas";
import { ZodError } from "zod";

// ─── Shared result type ───────────────────────────────────────────────────────

type ActionResult =
  | { success: true; message?: string }
  | { error: string; fieldErrors?: Record<string, string>; usernameSuggestions?: string[] };

// ─── Helper: flatten first Zod field error per path ──────────────────────────

function zodFieldErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path[0] as string;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function loginAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const raw = {
    email:    formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Please fix the errors below.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Surface friendly messages for the most common cases
    if (error.message.toLowerCase().includes("invalid login")) {
      return { error: "Incorrect email or password." };
    }
    return { error: error.message };
  }

  return { success: true };
}

// ─── Username suggestion helper ───────────────────────────────────────────────

async function getUsernameSuggestions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base: string,
): Promise<string[]> {
  // Generate deterministic + one random candidate
  const candidates = [
    `${base}1`, `${base}2`, `${base}3`, `${base}4`, `${base}5`,
    `${base}${Math.floor(Math.random() * 90 + 10)}`,
  ];

  const { data } = await supabase
    .from("profiles")
    .select("username")
    .in("username", candidates);

  const taken = new Set(
    (data ?? []).map((p: { username: string }) => p.username.toLowerCase()),
  );

  return candidates
    .filter((c) => !taken.has(c.toLowerCase()))
    .slice(0, 3);
}

// ─── Sign-Up ──────────────────────────────────────────────────────────────────

export async function signUpAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const raw = {
    email:           formData.get("email") as string,
    username:        (formData.get("username") as string).trim().toLowerCase(),
    password:        formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };

  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Please fix the errors below.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  const supabase = await createClient();

  // ── Username uniqueness check (query profiles table before creating auth user)
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", parsed.data.username)
    .maybeSingle();

  if (existingProfile) {
    const suggestions = await getUsernameSuggestions(supabase, parsed.data.username);
    return {
      error:               "Please fix the errors below.",
      fieldErrors:         { username: "Username is already taken." },
      usernameSuggestions: suggestions,
    };
  }

  // ── Create Supabase Auth user ─────────────────────────────────────────────
  const { error } = await supabase.auth.signUp({
    email:    parsed.data.email,
    password: parsed.data.password,
    options:  {
      data: { username: parsed.data.username },
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "An account with this email already exists." };
    }
    return { error: error.message };
  }

  return { success: true, message: "Account created! Check your email to verify your address." };
}

// ─── Forgot Password ──────────────────────────────────────────────────────────

export async function forgotPasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const raw = { email: formData.get("email") as string };

  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Please fix the errors below.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  const supabase = await createClient();

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/reset-password`,
  });

  if (error) return { error: error.message };

  // Always return success — avoids user enumeration via timing/response difference
  return {
    success: true,
    message: "If that email is registered, a reset link has been sent.",
  };
}

// ─── Reset Password ───────────────────────────────────────────────────────────

export async function resetPasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const raw = {
    password:        formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };

  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Please fix the errors below.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) return { error: error.message };

  return { success: true, message: "Password updated! You can now sign in with your new password." };
}
