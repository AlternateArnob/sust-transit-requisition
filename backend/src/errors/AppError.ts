export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "ACCOUNT_DEACTIVATED"
  | "ACCOUNT_NOT_VERIFIED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VEHICLE_NOT_ELIGIBLE"
  | "INVALID_STATE"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  // Specific codes (Part 1 §8, §12). The HTTP status stays with the factory that creates them.
  | "EMAIL_TAKEN"
  | "EMAIL_DOMAIN_NOT_ALLOWED"
  | "OTP_NOT_FOUND"
  | "OTP_EXPIRED"
  | "OTP_ATTEMPTS_EXCEEDED"
  | "OTP_INVALID"
  | "EMAIL_DELIVERY_FAILED"
  | "PAYLOAD_TOO_LARGE"
  | "DUPLICATE_REGISTRATION"
  | "VEHICLE_HAS_HISTORY"
  | "VEHICLE_HAS_UPCOMING_ALLOCATIONS"
  | "DRIVER_IN_USE";

export interface ErrorDetail {
  path?: string;
  message: string;
}

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message = "Bad request", details?: unknown) =>
  new AppError(400, "BAD_REQUEST", message, details);

export const unauthenticated = (message = "Authentication required") =>
  new AppError(401, "UNAUTHENTICATED", message);

export const forbidden = (message = "You do not have permission to perform this action") =>
  new AppError(403, "FORBIDDEN", message);

export const notFound = (message = "Resource not found") => new AppError(404, "NOT_FOUND", message);

/** 409 with a specific code, e.g. `conflict("EMAIL_TAKEN", "...")`. */
export const conflict = (code: ErrorCode = "CONFLICT", message = "Conflict", details?: unknown) =>
  new AppError(409, code, message, details);

export const invalidState = (message = "This action is not allowed in the current status") =>
  new AppError(409, "INVALID_STATE", message);

export const validation = (details: ErrorDetail[], message = "Validation failed") =>
  new AppError(422, "VALIDATION_ERROR", message, details);

export const rateLimited = (
  message = "Too many requests, please try again later",
  details?: unknown,
) => new AppError(429, "RATE_LIMITED", message, details);

/** Wrong email or wrong password. One message for both so the response never reveals which (§8.5). */
export const invalidCredentials = () =>
  new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");

export const accountDeactivated = () =>
  new AppError(
    403,
    "ACCOUNT_DEACTIVATED",
    "Your account has been deactivated. Contact a Super Admin.",
  );

export const emailDeliveryFailed = () =>
  new AppError(
    502,
    "EMAIL_DELIVERY_FAILED",
    "We could not send the verification email. Please try again in a moment.",
  );
