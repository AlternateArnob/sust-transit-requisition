import { z } from "zod";
import { env } from "../../config/env.js";
import { PASSWORD_MAX_LENGTH } from "../../services/password.js";

/** Lower-cased and trimmed, like the `users.email` column (Part 1 §10.2). */
const emailField = z.string().trim().toLowerCase().min(1, "Email is required").max(255);

/** Registration and resend need a real email shape; the SUST-domain rule is checked in the service. */
const strictEmail = emailField.pipe(z.email("Enter a valid email address"));

const otpCode = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${env.OTP_LENGTH}}$`), `Enter the ${env.OTP_LENGTH}-digit code`);

export const registerBody = z.strictObject({ email: strictEmail });

export const verifyOtpBody = z.strictObject({ email: emailField, code: otpCode });

export const resendOtpBody = z.strictObject({ email: emailField });

/** Login accepts any email text: an unknown address must get the same 401 as a wrong password. */
export const loginBody = z.strictObject({
  email: emailField,
  password: z
    .string()
    .min(1, "Password is required")
    .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`),
});

export type RegisterBody = z.infer<typeof registerBody>;
export type VerifyOtpBody = z.infer<typeof verifyOtpBody>;
export type ResendOtpBody = z.infer<typeof resendOtpBody>;
export type LoginBody = z.infer<typeof loginBody>;
