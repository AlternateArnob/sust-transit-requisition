import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

let transport: Transporter | undefined;

function createTransport(): Transporter {
  // Tests never open a socket; the message is only rendered to JSON.
  if (env.NODE_ENV === "test") return nodemailer.createTransport({ jsonTransport: true });
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
  });
}

/** Replaces the SMTP transport (tests inject a stub; pass undefined to reset). */
export function setMailTransport(next: Transporter | undefined): void {
  transport = next;
}

export interface OtpEmailOptions {
  /** Minutes the code stays valid, used in the text only. */
  ttlMinutes?: number;
}

/** Sends the one-time code. Rejects when the SMTP server cannot be reached. */
export async function sendOtpEmail(
  email: string,
  code: string,
  options: OtpEmailOptions = {},
): Promise<void> {
  const ttl = options.ttlMinutes ?? env.OTP_TTL_MINUTES;
  transport ??= createTransport();

  if (env.NODE_ENV === "development") {
    // Convenience for local work without a mail catcher. Never in production or test.
    console.info(`[mail] OTP for ${email}: ${code}`);
  }

  await transport.sendMail({
    from: env.MAIL_FROM,
    to: email,
    subject: "Your SUST Transport verification code",
    text:
      `Your verification code is ${code}.\n\n` +
      `It expires in ${ttl} minutes. If you did not request it, you can ignore this email.`,
  });
  logger.info({ to: email }, "OTP email sent");
}
