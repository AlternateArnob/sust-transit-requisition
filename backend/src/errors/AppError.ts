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
  | "INTERNAL_ERROR";

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

export const conflict = (
  code: Extract<ErrorCode, "CONFLICT" | "VEHICLE_NOT_ELIGIBLE"> = "CONFLICT",
  message = "Conflict",
  details?: unknown,
) => new AppError(409, code, message, details);

export const invalidState = (message = "This action is not allowed in the current status") =>
  new AppError(409, "INVALID_STATE", message);

export const validation = (details: ErrorDetail[], message = "Validation failed") =>
  new AppError(422, "VALIDATION_ERROR", message, details);

export const rateLimited = (message = "Too many requests, please try again later") =>
  new AppError(429, "RATE_LIMITED", message);
