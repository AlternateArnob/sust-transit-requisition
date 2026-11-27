import type { RequestHandler } from "express";
import { CSRF_HEADER, CSRF_HEADER_VALUE } from "../config/constants.js";
import { forbidden } from "../errors/AppError.js";

/**
 * Part 1 §8.4. The refresh cookie is sent automatically by the browser, so `/auth/refresh` and
 * `/auth/logout` also require a custom header. A cross-site form or image cannot set it, and a
 * cross-site `fetch` that does is blocked by the CORS allow-list.
 */
export const requireCsrfHeader: RequestHandler = (req, _res, next) => {
  if (req.get(CSRF_HEADER) !== CSRF_HEADER_VALUE) {
    throw forbidden(`Missing "X-Requested-With: ${CSRF_HEADER_VALUE}" header`);
  }
  next();
};
