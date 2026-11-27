import express, { type RequestHandler } from "express";
import multer from "multer";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";

// File upload parsing (Part 1 §14). Files are read into memory (they are capped at a few MB) so
// nothing unchecked is ever written to disk: the route validates the bytes first and only then
// stores them (services/fileStorage.ts).

export const SIGNATURE_FIELD = "file";

/** A base64 data URL is about 4/3 of the file size, plus the `data:image/png;base64,` prefix. */
const signatureJsonLimitBytes = (): number => Math.ceil((env.MAX_SIGNATURE_BYTES * 4) / 3) + 1024;

/** Turns anything multer or busboy throws into the uniform error format. */
export function toUploadError(error: unknown): unknown {
  if (error instanceof AppError) return error;
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        return new AppError(413, "PAYLOAD_TOO_LARGE", "The uploaded file is too large.");
      case "LIMIT_UNEXPECTED_FILE":
        return new AppError(422, "VALIDATION_ERROR", "Unexpected file field", [
          {
            path: error.field ?? SIGNATURE_FIELD,
            message: `Send the file in the "${SIGNATURE_FIELD}" field`,
          },
        ]);
      default:
        return new AppError(400, "BAD_REQUEST", "The upload could not be read.");
    }
  }
  // Busboy reports a malformed multipart body as a plain Error.
  if (error instanceof Error && /multipart|boundary|unexpected end of form/i.test(error.message)) {
    return new AppError(400, "BAD_REQUEST", "Malformed multipart request.");
  }
  return error;
}

/**
 * Reads a signature sent either as `multipart/form-data` (field `file`, the recommended way) or
 * as JSON `{ "signatureDataUrl": "data:image/png;base64,..." }` (transitional, Part 1 §14).
 * The multipart size limit is enforced while streaming; the JSON body gets its own, larger limit
 * than the app-wide 100 kb, which is why `app.ts` leaves this route's JSON to this middleware.
 * Run it after `authenticate`, so only logged-in users cause anything to be parsed.
 */
export function acceptSignature(): RequestHandler {
  const multipart = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.MAX_SIGNATURE_BYTES, files: 1, fields: 0 },
  }).single(SIGNATURE_FIELD);
  const json = express.json({ limit: signatureJsonLimitBytes() });

  return (req, res, next) => {
    if (req.is("multipart/form-data")) {
      multipart(req, res, (error?: unknown) => next(error ? toUploadError(error) : undefined));
      return;
    }
    if (req.is("application/json")) {
      json(req, res, next);
      return;
    }
    next(
      new AppError(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        `Send the signature as multipart/form-data (field "${SIGNATURE_FIELD}") or as JSON { "signatureDataUrl": "..." }.`,
      ),
    );
  };
}
