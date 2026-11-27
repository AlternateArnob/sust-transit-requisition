import type { RequestHandler } from "express";
import type { UserRole } from "../config/constants.js";
import { forbidden, unauthenticated, AppError } from "../errors/AppError.js";
import { findUserById, type UserRecord } from "../modules/users/user.repository.js";
import { verifyAccessToken, type TokenScope } from "../services/tokens.js";

/** What `authenticate` attaches to `req.user`. `record` is the user row as loaded for this request. */
export interface AuthUser {
  id: string;
  email: string;
  /** Always the role stored in the database, never the one in the token (Part 1 §8.4). */
  role: UserRole;
  scope: TokenScope;
  record: UserRecord;
}

export interface AuthenticateOptions {
  /** Accept `scope: "onboarding"` tokens (OTP, profile and signature routes only). */
  allowOnboarding?: boolean;
}

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token, ...rest] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token || rest.length > 0) return null;
  return token;
}

/**
 * Part 1 §8.4. Verifies the bearer token, then loads the user from the database on every request,
 * so deactivation and role changes take effect on the next call rather than at token expiry.
 */
export function authenticate(options: AuthenticateOptions = {}): RequestHandler {
  return async (req, _res, next) => {
    const token = bearerToken(req.get("authorization"));
    if (!token) throw unauthenticated();

    const claims = verifyAccessToken(token);
    const record = await findUserById(claims.sub);
    if (!record) throw unauthenticated("Account no longer exists");
    if (!record.isActive) {
      throw new AppError(
        403,
        "ACCOUNT_DEACTIVATED",
        "Your account has been deactivated. Contact a Super Admin.",
      );
    }

    if (claims.scope === "onboarding") {
      if (!options.allowOnboarding) {
        throw forbidden("Finish setting up your account to continue.");
      }
    } else if (!record.isVerified) {
      // A full-scope token for an unverified account cannot be minted; this is defence in depth.
      throw new AppError(403, "ACCOUNT_NOT_VERIFIED", "Verify your email to continue.");
    }

    req.user = {
      id: record.id,
      email: record.email,
      role: record.role,
      scope: claims.scope,
      record,
    };
    next();
  };
}

/** Allows only the listed roles (403 FORBIDDEN otherwise). Must run after `authenticate`. */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw unauthenticated();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
}

/** Like `requireRole` but takes a capability predicate from `domain/permissions.ts`. */
export function requireCapability(check: (role: UserRole) => boolean): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw unauthenticated();
    if (!check(req.user.role)) throw forbidden();
    next();
  };
}
