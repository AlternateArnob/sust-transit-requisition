import type { Request } from "express";
import { ipKeyGenerator, MemoryStore, rateLimit, type Options } from "express-rate-limit";
import { GLOBAL_RATE_LIMIT } from "../config/constants.js";
import { rateLimited } from "../errors/AppError.js";

export interface RateLimiterOptions {
  windowMs: number;
  limit: number;
  message?: string;
  skip?: Options["skip"];
  keyGenerator?: Options["keyGenerator"];
  /** Give a store to be able to reset it from tests (see `resetRateLimitStores`). */
  store?: MemoryStore;
}

/** Factory for per-route limiters (login, OTP, ...). Responds with the uniform 429 error. */
export function createRateLimiter({
  windowMs,
  limit,
  message,
  skip,
  keyGenerator,
  store,
}: RateLimiterOptions) {
  return rateLimit({
    windowMs,
    limit,
    skip,
    keyGenerator,
    store,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, res, next) => {
      const retryAfter = Number(res.getHeader("Retry-After"));
      next(
        rateLimited(
          message,
          Number.isFinite(retryAfter) && retryAfter > 0
            ? { retryAfterSeconds: retryAfter }
            : undefined,
        ),
      );
    },
  });
}

export const createGlobalRateLimiter = () => createRateLimiter(GLOBAL_RATE_LIMIT);

// --- Auth limiters (Part 1 §8.5) ---------------------------------------------------------------

const stores: MemoryStore[] = [];
function trackedStore(): MemoryStore {
  const store = new MemoryStore();
  stores.push(store);
  return store;
}

/** Tests call this between cases so one test's requests never count against another. */
export function resetRateLimitStores(): void {
  for (const store of stores) store.resetAll();
}

const clientIp = (req: Request): string => ipKeyGenerator(req.ip ?? "unknown");

const emailFromBody = (req: Request): string => {
  const email: unknown = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" ? email.trim().toLowerCase().slice(0, 255) : "";
};

const FIFTEEN_MINUTES = 15 * 60_000;

/** 10 attempts per 15 minutes per IP + email. */
export const loginLimiter = createRateLimiter({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  message: "Too many login attempts. Please try again later.",
  keyGenerator: (req) => `${clientIp(req)}|${emailFromBody(req)}`,
  store: trackedStore(),
});

/** 10 registrations per hour per IP. */
export const registerLimiter = createRateLimiter({
  windowMs: 60 * 60_000,
  limit: 10,
  message: "Too many registration attempts. Please try again later.",
  keyGenerator: clientIp,
  store: trackedStore(),
});

/** 20 OTP verify/resend calls per 15 minutes per IP (the per-email caps live in services/otp.ts). */
export const otpLimiter = createRateLimiter({
  windowMs: FIFTEEN_MINUTES,
  limit: 20,
  message: "Too many code requests. Please try again later.",
  keyGenerator: clientIp,
  store: trackedStore(),
});
