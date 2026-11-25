import { describe, expect, it } from "vitest";
import {
  AppError,
  badRequest,
  conflict,
  forbidden,
  invalidState,
  notFound,
  rateLimited,
  unauthenticated,
  validation,
} from "../../src/errors/AppError.js";

describe("AppError factories", () => {
  it.each([
    ["badRequest", badRequest(), 400, "BAD_REQUEST"],
    ["unauthenticated", unauthenticated(), 401, "UNAUTHENTICATED"],
    ["forbidden", forbidden(), 403, "FORBIDDEN"],
    ["notFound", notFound(), 404, "NOT_FOUND"],
    ["conflict", conflict(), 409, "CONFLICT"],
    [
      "conflict (vehicle)",
      conflict("VEHICLE_NOT_ELIGIBLE", "blocked"),
      409,
      "VEHICLE_NOT_ELIGIBLE",
    ],
    ["invalidState", invalidState(), 409, "INVALID_STATE"],
    ["validation", validation([{ path: "a", message: "bad" }]), 422, "VALIDATION_ERROR"],
    ["rateLimited", rateLimited(), 429, "RATE_LIMITED"],
  ])("%s maps to the status and code in Part 1 §7.4", (_name, error, status, code) => {
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
  });

  it("carries details through", () => {
    const error = validation([{ path: "trips.0.startTime", message: "Required" }]);
    expect(error.details).toEqual([{ path: "trips.0.startTime", message: "Required" }]);
  });
});
