import type { ErrorRequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { AppError, type ErrorCode, type ErrorDetail } from "../errors/AppError.js";
import { toUploadError } from "./upload.js";

interface ErrorBody {
  error: { code: ErrorCode; message: string; details?: unknown; requestId: string };
}

const BODY_PARSER_TYPE = /^(entity|encoding|charset|request|stream|parameters)\./;

function isBodyParserError(err: unknown): err is { status: number; type: string } {
  if (typeof err !== "object" || err === null) return false;
  const { status, type } = err as { status?: unknown; type?: unknown };
  return (
    typeof status === "number" &&
    status >= 400 &&
    status < 500 &&
    typeof type === "string" &&
    BODY_PARSER_TYPE.test(type)
  );
}

function isDuplicateEntry(err: unknown): boolean {
  return (
    typeof err === "object" && err !== null && (err as { code?: unknown }).code === "ER_DUP_ENTRY"
  );
}

function zodDetails(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

// Express identifies error middleware by its 4-argument signature, so `_next` must stay.
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const requestId = String(req.id ?? "");
  let status = 500;
  let code: ErrorCode = "INTERNAL_ERROR";
  let message = "Internal server error";
  let details: unknown;

  if (err instanceof AppError) {
    ({ status, code, message, details } = err);
  } else if (err instanceof ZodError) {
    status = 422;
    code = "VALIDATION_ERROR";
    message = "Validation failed";
    details = zodDetails(err);
  } else if (err instanceof multer.MulterError) {
    const upload = toUploadError(err);
    if (upload instanceof AppError) ({ status, code, message, details } = upload);
  } else if (isDuplicateEntry(err)) {
    status = 409;
    code = "CONFLICT";
    message = "A record with the same unique value already exists";
  } else if (isBodyParserError(err)) {
    status = err.status;
    code = "BAD_REQUEST";
    message =
      err.type === "entity.parse.failed"
        ? "Malformed JSON in request body"
        : err.type === "entity.too.large"
          ? "Request body is too large"
          : "Bad request";
  }

  if (status >= 500) {
    // Full error goes to the log only; the client gets a generic message.
    req.log?.error({ err, requestId }, "Unhandled error");
  }

  const body: ErrorBody = {
    error: { code, message, ...(details !== undefined ? { details } : {}), requestId },
  };
  res.status(status).json(body);
};
