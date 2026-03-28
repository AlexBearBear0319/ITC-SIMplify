import { z } from "zod";

// ─── Reusable password rule ───────────────────────────────────────────────────

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .regex(/[A-Z]/, "Password must contain at least 1 uppercase letter.")
  .regex(/[0-9]/, "Password must contain at least 1 number.");

// ─── Sign-Up ──────────────────────────────────────────────────────────────────

export const signUpSchema = z
  .object({
    email:           z.string().email("Please enter a valid email address."),
    username:        z
      .string()
      .min(3, "Username must be at least 3 characters.")
      .regex(/^[a-zA-Z0-9]+$/, "Username can only contain letters and numbers."),
    password:        passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match.",
    path:    ["confirmPassword"],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;

// ─── Login ────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email:    z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ─── Forgot Password ──────────────────────────────────────────────────────────

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// ─── Reset Password ───────────────────────────────────────────────────────────

export const resetPasswordSchema = z
  .object({
    password:        passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match.",
    path:    ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
