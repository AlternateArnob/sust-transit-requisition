import { rateLimit, type Options } from "express-rate-limit";
import { GLOBAL_RATE_LIMIT } from "../config/constants.js";
import { rateLimited } from "../errors/AppError.js";

export interface RateLimiterOptions {
  windowMs: number;
  limit: number;
  message?: string;
  skip?: Options["skip"];
}

/** Factory for per-route limiters (login, OTP, ... in Step 4). Responds with the uniform 429 error. */
export function createRateLimiter({ windowMs, limit, message, skip }: RateLimiterOptions) {
  return rateLimit({
    windowMs,
    limit,
    skip,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, _res, next) => next(rateLimited(message)),
  });
}

export const createGlobalRateLimiter = () => createRateLimiter(GLOBAL_RATE_LIMIT);
