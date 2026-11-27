import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { v4 as uuid } from "uuid";
import type { OtpPurpose } from "../config/constants.js";
import { env } from "../config/env.js";
import { db } from "../db/knex.js";
import type { DbExecutor } from "../db/transaction.js";
import { fromDbDateTime } from "../db/time.js";
import { AppError, rateLimited } from "../errors/AppError.js";

// Email one-time codes (Part 1 §8.2). One active challenge per email; the plain code is never
// stored, only `salt:sha256(salt:email:code)`.

/** Part 1 §8.2: at most this many sends per email inside one window. */
export const OTP_MAX_SENDS_PER_WINDOW = 5;
export const OTP_SEND_WINDOW_MS = 60 * 60 * 1000;

export type OtpFailureReason = "no-challenge" | "expired" | "attempts-exceeded" | "wrong-code";

export interface IssuedOtp {
  /** The plain code. Hand it to the mailer; never persist or log it (except OTP_DEV_ECHO). */
  code: string;
  expiresAt: Date;
  /** When the next resend is allowed. */
  resendAvailableAt: Date;
}

export type VerifyOtpResult =
  { ok: true; purpose: OtpPurpose } | { ok: false; reason: OtpFailureReason };

interface OtpRow {
  id: string;
  email: string;
  code_hash: string;
  purpose: OtpPurpose;
  expires_at: string;
  attempts: number;
  last_sent_at: string;
  send_count: number;
  send_window_started_at: string | null;
}

interface OtpOptions {
  /** Join an open transaction instead of starting one. */
  trx?: DbExecutor;
  /** Injectable clock for tests. */
  now?: Date;
}

/** A `OTP_LENGTH`-digit code from the OS CSPRNG (never Math.random). */
export function generateCode(length: number = env.OTP_LENGTH): string {
  return String(randomInt(0, 10 ** length)).padStart(length, "0");
}

function hashCode(email: string, code: string, salt: string = randomBytes(16).toString("hex")) {
  const digest = createHash("sha256").update(`${salt}:${email}:${code}`).digest("hex");
  return { salt, stored: `${salt}:${digest}` };
}

function codeMatches(stored: string, email: string, code: string): boolean {
  const [salt, digest] = stored.split(":");
  if (!salt || !digest) return false;
  const expected = Buffer.from(digest, "hex");
  const actual = Buffer.from(hashCode(email, code, salt).stored.split(":")[1] ?? "", "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const seconds = (ms: number) => Math.max(1, Math.ceil(ms / 1000));

function run<T>(options: OtpOptions, fn: (trx: DbExecutor) => Promise<T>): Promise<T> {
  const executor = options.trx ?? db;
  return (executor as typeof db).transaction(fn);
}

/**
 * Creates or replaces the challenge for `email` and returns the new plain code.
 * Throws 429 RATE_LIMITED (with `details.retryAfterSeconds`) during the resend cooldown or after
 * 5 sends in an hour.
 */
export async function issueOtp(
  email: string,
  purpose: OtpPurpose,
  options: OtpOptions = {},
): Promise<IssuedOtp> {
  const now = options.now ?? new Date();
  const code = generateCode();
  const { stored } = hashCode(email, code);
  const expiresAt = new Date(now.getTime() + env.OTP_TTL_MINUTES * 60_000);
  const resendAvailableAt = new Date(now.getTime() + env.OTP_RESEND_COOLDOWN_SECONDS * 1000);

  // Two parallel first requests can both miss the row and both insert. InnoDB resolves that with a
  // duplicate-key error or a gap-lock deadlock; either way the loser retries and then sees the row.
  const MAX_ATTEMPTS = 3;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      await run(options, async (trx) => {
        const row = await trx<OtpRow>("otp_challenges").where({ email }).forUpdate().first();

        if (!row) {
          await trx("otp_challenges").insert({
            id: uuid(),
            email,
            code_hash: stored,
            purpose,
            expires_at: expiresAt,
            attempts: 0,
            last_sent_at: now,
            send_count: 1,
            send_window_started_at: now,
          });
          return;
        }

        const lastSentAt = fromDbDateTime(row.last_sent_at) ?? now;
        const sinceLast = now.getTime() - lastSentAt.getTime();
        const cooldownMs = env.OTP_RESEND_COOLDOWN_SECONDS * 1000;
        if (sinceLast < cooldownMs) {
          const retryAfterSeconds = seconds(cooldownMs - sinceLast);
          throw rateLimited(
            `Please wait ${retryAfterSeconds} seconds before requesting a new code.`,
            {
              retryAfterSeconds,
            },
          );
        }

        const windowStart = fromDbDateTime(row.send_window_started_at) ?? lastSentAt;
        const inWindow = now.getTime() - windowStart.getTime() < OTP_SEND_WINDOW_MS;
        if (inWindow && row.send_count >= OTP_MAX_SENDS_PER_WINDOW) {
          const retryAfterSeconds = seconds(
            windowStart.getTime() + OTP_SEND_WINDOW_MS - now.getTime(),
          );
          throw rateLimited("Too many codes requested for this email. Try again later.", {
            retryAfterSeconds,
          });
        }

        await trx("otp_challenges")
          .where({ id: row.id })
          .update({
            code_hash: stored,
            purpose,
            expires_at: expiresAt,
            attempts: 0,
            last_sent_at: now,
            send_count: inWindow ? row.send_count + 1 : 1,
            send_window_started_at: inWindow ? windowStart : now,
          });
      });
      return { code, expiresAt, resendAvailableAt };
    } catch (error) {
      const dbCode = (error as { code?: string }).code;
      const retryable = dbCode === "ER_DUP_ENTRY" || dbCode === "ER_LOCK_DEADLOCK";
      if (!retryable || attempt === MAX_ATTEMPTS - 1) throw error;
    }
  }
  /* c8 ignore next */
  throw new AppError(500, "INTERNAL_ERROR", "Could not issue a code");
}

/**
 * Checks `code` against the challenge for `email`. A wrong code costs one attempt; once
 * OTP_MAX_ATTEMPTS is used up the challenge is locked until a new one is requested. A correct code
 * deletes the challenge.
 *
 * It returns the failure instead of throwing so that the attempt counter is committed: pass the
 * result to `otpFailureToError` after the transaction has finished.
 */
export async function verifyOtp(
  email: string,
  code: string,
  options: OtpOptions = {},
): Promise<VerifyOtpResult> {
  const now = options.now ?? new Date();

  return run(options, async (trx): Promise<VerifyOtpResult> => {
    const row = await trx<OtpRow>("otp_challenges").where({ email }).forUpdate().first();
    if (!row) return { ok: false, reason: "no-challenge" };

    const expiresAt = fromDbDateTime(row.expires_at);
    if (!expiresAt || expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
    if (row.attempts >= env.OTP_MAX_ATTEMPTS) return { ok: false, reason: "attempts-exceeded" };

    if (!codeMatches(row.code_hash, email, code)) {
      const attempts = row.attempts + 1;
      await trx("otp_challenges").where({ id: row.id }).update({ attempts });
      return {
        ok: false,
        reason: attempts >= env.OTP_MAX_ATTEMPTS ? "attempts-exceeded" : "wrong-code",
      };
    }

    await trx("otp_challenges").where({ id: row.id }).delete();
    return { ok: true, purpose: row.purpose };
  });
}

/** Maps a failed verification to the API error of Part 1 §8.2. */
export function otpFailureToError(reason: OtpFailureReason): AppError {
  switch (reason) {
    case "no-challenge":
      return new AppError(
        422,
        "OTP_NOT_FOUND",
        "No active code for this email. Request a new one.",
      );
    case "expired":
      return new AppError(422, "OTP_EXPIRED", "This code has expired. Request a new one.");
    case "attempts-exceeded":
      return new AppError(
        429,
        "OTP_ATTEMPTS_EXCEEDED",
        "Too many wrong attempts. Request a new code.",
      );
    case "wrong-code":
      return new AppError(422, "OTP_INVALID", "That code is not correct.");
  }
}
