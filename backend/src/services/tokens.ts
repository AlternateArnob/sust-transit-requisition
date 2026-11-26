import { createHash, randomBytes } from "node:crypto";
import type { CookieOptions, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import { USER_ROLES, type UserRole } from "../config/constants.js";
import { env } from "../config/env.js";
import { db } from "../db/knex.js";
import { fromDbDateTime } from "../db/time.js";
import type { DbExecutor } from "../db/transaction.js";
import { unauthenticated } from "../errors/AppError.js";

// Part 1 §8.4. Access token: short-lived JWT in memory on the client. Refresh token: opaque random
// value, stored only as a SHA-256 hash, rotated on every use, family-revoked on reuse.

export type TokenScope = "full" | "onboarding";

export interface AccessClaims {
  sub: string;
  role: UserRole;
  scope: TokenScope;
  jti: string;
}

/** `JWT_ACCESS_TTL` ("15m", "1h", "30s", "7d") in seconds. */
export function parseTtlSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) throw new Error(`Invalid TTL: ${ttl}`);
  const unit = { s: 1, m: 60, h: 3600, d: 86_400 }[match[2] as "s" | "m" | "h" | "d"];
  return Number(match[1]) * unit;
}

export const ACCESS_TTL_SECONDS = parseTtlSeconds(env.JWT_ACCESS_TTL);
/**
 * Onboarding tokens have no refresh cookie behind them, so they live a bit longer than an access
 * token: long enough to read an email, enter the code and draw a signature.
 */
export const ONBOARDING_TTL_SECONDS = 30 * 60;

const ALGORITHM = "HS256";

export function signAccessToken(claims: { sub: string; role: UserRole; scope: TokenScope }): {
  token: string;
  expiresIn: number;
} {
  const expiresIn = claims.scope === "onboarding" ? ONBOARDING_TTL_SECONDS : ACCESS_TTL_SECONDS;
  const token = jwt.sign({ role: claims.role, scope: claims.scope }, env.JWT_ACCESS_SECRET, {
    algorithm: ALGORITHM,
    subject: claims.sub,
    jwtid: uuid(),
    expiresIn,
  });
  return { token, expiresIn };
}

/** Verifies signature, algorithm and expiry. Throws 401 UNAUTHENTICATED for anything wrong. */
export function verifyAccessToken(token: string): AccessClaims {
  let payload: jwt.JwtPayload | string;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: [ALGORITHM] });
  } catch {
    throw unauthenticated("Invalid or expired access token");
  }
  if (typeof payload === "string") throw unauthenticated("Invalid access token");

  const { sub, role, scope, jti } = payload as Record<string, unknown>;
  if (
    typeof sub !== "string" ||
    typeof jti !== "string" ||
    (scope !== "full" && scope !== "onboarding") ||
    !USER_ROLES.includes(role as UserRole)
  ) {
    throw unauthenticated("Invalid access token");
  }
  return { sub, role: role as UserRole, scope, jti };
}

// ---------------------------------------------------------------------------------------------
// Refresh tokens
// ---------------------------------------------------------------------------------------------

export interface RefreshMeta {
  userAgent?: string | null;
  ip?: string | null;
}

export interface IssuedRefreshToken {
  /** The opaque value for the cookie. Only its hash is stored. */
  token: string;
  id: string;
  familyId: string;
  expiresAt: Date;
}

interface RefreshRow {
  id: string;
  user_id: string;
  family_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
}

export const hashToken = (raw: string): string => createHash("sha256").update(raw).digest("hex");

const trim = (value: string | null | undefined, max: number) =>
  value ? value.slice(0, max) : null;

export async function createRefreshToken(
  userId: string,
  meta: RefreshMeta = {},
  options: { trx?: DbExecutor; familyId?: string; now?: Date } = {},
): Promise<IssuedRefreshToken> {
  const executor = options.trx ?? db;
  const now = options.now ?? new Date();
  const token = randomBytes(32).toString("base64url"); // 256 bits
  const id = uuid();
  const familyId = options.familyId ?? uuid();
  const expiresAt = new Date(now.getTime() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);

  await executor("refresh_tokens").insert({
    id,
    user_id: userId,
    family_id: familyId,
    token_hash: hashToken(token),
    expires_at: expiresAt,
    user_agent: trim(meta.userAgent, 255),
    ip: trim(meta.ip, 45),
    created_at: now,
  });
  return { token, id, familyId, expiresAt };
}

export interface RotatedRefreshToken extends IssuedRefreshToken {
  userId: string;
}

/**
 * Exchanges a refresh token for a new one in the same family and revokes the old one.
 * Throws 401 when the token is unknown or expired. Presenting an already-revoked token means it
 * was stolen or replayed, so the whole family is revoked (and the revocation is committed) first.
 */
export async function rotateRefreshToken(
  rawToken: string,
  meta: RefreshMeta = {},
  now: Date = new Date(),
): Promise<RotatedRefreshToken> {
  type Outcome = { kind: "ok"; rotated: RotatedRefreshToken } | { kind: "reuse" | "invalid" };

  const outcome = await db.transaction(async (trx): Promise<Outcome> => {
    const row = await trx<RefreshRow>("refresh_tokens")
      .where({ token_hash: hashToken(rawToken) })
      .forUpdate()
      .first();
    if (!row) return { kind: "invalid" };

    if (row.revoked_at !== null) {
      await trx("refresh_tokens")
        .where({ family_id: row.family_id })
        .whereNull("revoked_at")
        .update({ revoked_at: now });
      return { kind: "reuse" };
    }

    const expiresAt = fromDbDateTime(row.expires_at);
    if (!expiresAt || expiresAt.getTime() <= now.getTime()) return { kind: "invalid" };

    const next = await createRefreshToken(row.user_id, meta, {
      trx,
      familyId: row.family_id,
      now,
    });
    await trx("refresh_tokens")
      .where({ id: row.id })
      .update({ revoked_at: now, replaced_by: next.id });
    return { kind: "ok", rotated: { ...next, userId: row.user_id } };
  });

  if (outcome.kind !== "ok") throw unauthenticated("Session expired. Please log in again.");
  return outcome.rotated;
}

/** Revokes every live refresh token of a user (deactivation, password change). */
export async function revokeAllForUser(
  userId: string,
  options: { trx?: DbExecutor; now?: Date } = {},
): Promise<number> {
  return (options.trx ?? db)("refresh_tokens")
    .where({ user_id: userId })
    .whereNull("revoked_at")
    .update({ revoked_at: options.now ?? new Date() });
}

/**
 * Logout: revokes the whole rotation family of this token (one family = one browser session).
 * Returns the owner's id, or null when the token is unknown.
 */
export async function revokeByToken(
  rawToken: string,
  options: { trx?: DbExecutor; now?: Date } = {},
): Promise<string | null> {
  const executor = options.trx ?? db;
  const row = await executor<RefreshRow>("refresh_tokens")
    .where({ token_hash: hashToken(rawToken) })
    .first();
  if (!row) return null;
  await executor("refresh_tokens")
    .where({ family_id: row.family_id })
    .whereNull("revoked_at")
    .update({ revoked_at: options.now ?? new Date() });
  return row.user_id;
}

// ---------------------------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------------------------

/** The cookie is only ever sent to `/auth/*` (Part 1 §8.4). */
export const REFRESH_COOKIE_PATH = `${env.API_BASE_PATH}/auth`;

const baseCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAMESITE,
  path: REFRESH_COOKIE_PATH,
});

export function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(env.REFRESH_COOKIE_NAME, token, { ...baseCookieOptions(), expires: expiresAt });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(env.REFRESH_COOKIE_NAME, baseCookieOptions());
}

export function readRefreshCookie(req: Request): string | null {
  const value: unknown = req.cookies?.[env.REFRESH_COOKIE_NAME];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** User agent and IP for the `refresh_tokens` audit columns. */
export function requestMeta(req: Request): RefreshMeta {
  return { userAgent: req.get("user-agent") ?? null, ip: req.ip ?? null };
}
