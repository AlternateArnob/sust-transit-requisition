import type { OtpPurpose } from "../../config/constants.js";
import { LOGIN_LOCKOUT_MINUTES, LOGIN_MAX_FAILED_ATTEMPTS } from "../../config/constants.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { db } from "../../db/knex.js";
import { fromDbDateTime } from "../../db/time.js";
import { isSustEmail } from "../../domain/recommendation.js";
import {
  accountDeactivated,
  AppError,
  conflict,
  emailDeliveryFailed,
  invalidCredentials,
  rateLimited,
  unauthenticated,
} from "../../errors/AppError.js";
import { sendOtpEmail } from "../../services/mailer.js";
import {
  issueOtp,
  otpFailureToError,
  verifyOtp,
  type OtpFailureReason,
} from "../../services/otp.js";
import { burnPasswordCheck, verifyPassword } from "../../services/password.js";
import {
  createRefreshToken,
  revokeAllForUser,
  revokeByToken,
  rotateRefreshToken,
  signAccessToken,
  type IssuedRefreshToken,
  type RefreshMeta,
} from "../../services/tokens.js";
import { toPublicUser, type PublicUser } from "../users/user.mapper.js";
import {
  createUnverifiedApplicant,
  findUserByEmail,
  findUserById,
  markEmailVerified,
  recordFailedLogin,
  recordSuccessfulLogin,
  type UserRecord,
} from "../users/user.repository.js";

/** What the client needs to show the code screen (Part 1 §12.1 register response). */
export interface OtpDispatch {
  email: string;
  otpExpiresAt: string;
  resendAvailableAt: string;
  /** Only when `OTP_DEV_ECHO` is on (never in production, see config/env.ts). */
  devCode?: string;
}

export interface SessionResult {
  accessToken: string;
  expiresIn: number;
  user: PublicUser;
  refresh: IssuedRefreshToken;
}

export type LoginResult =
  | { kind: "session"; session: SessionResult }
  | { kind: "otp-required"; nextStep: "otp"; dispatch: OtpDispatch };

// ---------------------------------------------------------------------------------------------
// OTP helpers
// ---------------------------------------------------------------------------------------------

/**
 * Creates a new code for `email`, emails it and returns the timings for the client.
 *
 * If the mail server is down the challenge is removed again so the user can retry at once instead
 * of waiting out the resend cooldown. With `OTP_DEV_ECHO` on (development only) a mail failure is
 * tolerated, because the code is returned in the response anyway.
 */
async function dispatchOtp(email: string, purpose: OtpPurpose): Promise<OtpDispatch> {
  const issued = await issueOtp(email, purpose);

  try {
    await sendOtpEmail(email, issued.code);
  } catch (error) {
    logger.error({ err: error, to: email }, "Could not send the OTP email");
    if (!env.OTP_DEV_ECHO) {
      await db("otp_challenges").where({ email }).delete();
      throw emailDeliveryFailed();
    }
  }

  return {
    email,
    otpExpiresAt: issued.expiresAt.toISOString(),
    resendAvailableAt: issued.resendAvailableAt.toISOString(),
    ...(env.OTP_DEV_ECHO ? { devCode: issued.code } : {}),
  };
}

// ---------------------------------------------------------------------------------------------
// Registration and email verification (Part 1 §8.3 steps 1-2)
// ---------------------------------------------------------------------------------------------

export async function register(email: string): Promise<OtpDispatch> {
  if (!isSustEmail(email)) {
    throw new AppError(
      422,
      "EMAIL_DOMAIN_NOT_ALLOWED",
      "Use your SUST email address (e.g. name@student.sust.edu)",
      [{ path: "email", message: "Use your SUST email address (e.g. name@student.sust.edu)" }],
    );
  }

  const existing = await findUserByEmail(email);
  // A second registration of a still-unverified address just sends a fresh code.
  const user = existing ?? (await createUnverifiedApplicant(email));

  if (user.isVerified) {
    throw conflict("EMAIL_TAKEN", "This email is already registered. Try logging in instead.");
  }
  if (!user.isActive) throw accountDeactivated();

  return dispatchOtp(user.email, "registration");
}

export interface VerifyResult {
  onboardingToken: string;
  user: PublicUser;
}

/**
 * Checks the code and, if it is right, marks the email verified and returns an onboarding token.
 * Code check and verification commit together; a wrong guess is committed too (the attempt
 * counter must survive) and only then turned into an error.
 */
export async function verifyEmail(email: string, code: string): Promise<VerifyResult> {
  type Outcome = { ok: true; user: UserRecord } | { ok: false; error: AppError };

  const outcome = await db.transaction(async (trx): Promise<Outcome> => {
    const otp = await verifyOtp(email, code, { trx });
    if (!otp.ok) return { ok: false, error: otpFailureToError(otp.reason) };

    const user = await findUserByEmail(email, trx, { forUpdate: true });
    if (!user) {
      // A code for an address with no account; treat it like a missing challenge.
      return { ok: false, error: otpFailureToError("no-challenge" satisfies OtpFailureReason) };
    }
    if (!user.isActive) return { ok: false, error: accountDeactivated() };

    if (!user.isVerified) await markEmailVerified(user.id, trx);
    return { ok: true, user: { ...user, isVerified: true } };
  });

  if (!outcome.ok) throw outcome.error;

  const { token } = signAccessToken({
    sub: outcome.user.id,
    role: outcome.user.role,
    scope: "onboarding",
  });
  return { onboardingToken: token, user: toPublicUser(outcome.user) };
}

/**
 * Sends a new code to an account that still needs one. Unknown and already-verified addresses get
 * the same answer without any email being sent, so this endpoint cannot be used to find out which
 * addresses are registered or to spam the owner of an active account.
 */
export async function resendOtp(email: string): Promise<OtpDispatch> {
  const user = await findUserByEmail(email);
  if (!user || user.isVerified || !user.isActive) {
    const now = Date.now();
    return {
      email,
      otpExpiresAt: new Date(now + env.OTP_TTL_MINUTES * 60_000).toISOString(),
      resendAvailableAt: new Date(now + env.OTP_RESEND_COOLDOWN_SECONDS * 1000).toISOString(),
    };
  }
  return dispatchOtp(user.email, "registration");
}

// ---------------------------------------------------------------------------------------------
// Login, refresh, logout (Part 1 §8.3, §8.4)
// ---------------------------------------------------------------------------------------------

async function startSession(user: UserRecord, meta: RefreshMeta): Promise<SessionResult> {
  const { token, expiresIn } = signAccessToken({ sub: user.id, role: user.role, scope: "full" });
  const refresh = await createRefreshToken(user.id, meta);
  return { accessToken: token, expiresIn, user: toPublicUser(user), refresh };
}

/**
 * Part 1 §8.3, in this order: unknown email -> lock -> deactivated -> unverified or no password ->
 * password check.
 *
 * Deviation from the plan: an unverified account, or a verified one that never chose a password,
 * does NOT get an onboarding token here. The plan hands one out on a bare email address, and
 * onboarding tokens may set the password (`PUT /me/profile`), so anyone who knew an applicant's
 * email could take the account over. Instead a fresh code is emailed (`nextStep: "otp"`) and the
 * token is only issued by `POST /auth/otp/verify`, after the owner proved access to the mailbox.
 * Nothing about the account is returned either.
 */
export async function login(
  email: string,
  password: string,
  meta: RefreshMeta,
): Promise<LoginResult> {
  const now = new Date();
  const user = await findUserByEmail(email);

  if (!user) {
    await burnPasswordCheck(password); // keep unknown-email timing close to wrong-password timing
    throw invalidCredentials();
  }

  const lockedUntil = fromDbDateTime(user.lockedUntil);
  if (lockedUntil && lockedUntil.getTime() > now.getTime()) {
    throw rateLimited("Too many failed login attempts. Please try again later.", {
      retryAfterSeconds: Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000)),
    });
  }

  if (!user.isActive) throw accountDeactivated();

  if (!user.isVerified || !user.passwordHash) {
    const dispatch = await dispatchOtp(user.email, user.isVerified ? "resume" : "registration");
    return { kind: "otp-required", nextStep: "otp", dispatch };
  }

  if (!(await verifyPassword(user.passwordHash, password))) {
    await recordFailedLogin(user.id, {
      maxAttempts: LOGIN_MAX_FAILED_ATTEMPTS,
      lockUntil: new Date(now.getTime() + LOGIN_LOCKOUT_MINUTES * 60_000),
    });
    throw invalidCredentials();
  }

  await recordSuccessfulLogin(user.id, now);
  return { kind: "session", session: await startSession(user, meta) };
}

/** Rotates the refresh token and issues a new access token (Part 1 §8.4). */
export async function refreshSession(rawToken: string, meta: RefreshMeta): Promise<SessionResult> {
  const rotated = await rotateRefreshToken(rawToken, meta);

  const user = await findUserById(rotated.userId);
  if (!user || !user.isVerified) {
    await revokeAllForUser(rotated.userId);
    throw unauthenticated("Session expired. Please log in again.");
  }
  if (!user.isActive) {
    await revokeAllForUser(user.id);
    throw accountDeactivated();
  }

  const { token, expiresIn } = signAccessToken({ sub: user.id, role: user.role, scope: "full" });
  return { accessToken: token, expiresIn, user: toPublicUser(user), refresh: rotated };
}

/** Logout: revokes this browser session's refresh-token family. A missing token is fine. */
export async function logout(rawToken: string | null): Promise<void> {
  if (rawToken) await revokeByToken(rawToken);
}
