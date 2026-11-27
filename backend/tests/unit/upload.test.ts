import multer from "multer";
import { describe, expect, it } from "vitest";
import { AppError } from "../../src/errors/AppError.js";
import { toUploadError } from "../../src/middleware/upload.js";

describe("toUploadError", () => {
  it("maps an oversize file to 413 PAYLOAD_TOO_LARGE", () => {
    const error = toUploadError(new multer.MulterError("LIMIT_FILE_SIZE", "file")) as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect([error.status, error.code]).toEqual([413, "PAYLOAD_TOO_LARGE"]);
  });

  it("maps a wrong field name to 422 and names the expected field", () => {
    const error = toUploadError(
      new multer.MulterError("LIMIT_UNEXPECTED_FILE", "photo"),
    ) as AppError;
    expect([error.status, error.code]).toEqual([422, "VALIDATION_ERROR"]);
    expect(error.details).toEqual([
      { path: "photo", message: 'Send the file in the "file" field' },
    ]);
  });

  it("maps every other multer error to 400", () => {
    for (const code of ["LIMIT_FIELD_COUNT", "LIMIT_FILE_COUNT", "LIMIT_PART_COUNT"] as const) {
      const error = toUploadError(new multer.MulterError(code)) as AppError;
      expect([error.status, error.code]).toEqual([400, "BAD_REQUEST"]);
    }
  });

  it("maps malformed multipart errors from busboy to 400", () => {
    for (const message of ["Unexpected end of form", "Multipart: Boundary not found"]) {
      const error = toUploadError(new Error(message)) as AppError;
      expect([error.status, error.code]).toEqual([400, "BAD_REQUEST"]);
    }
  });

  it("passes AppErrors and unrelated errors through untouched", () => {
    const app = new AppError(418, "BAD_REQUEST", "teapot");
    expect(toUploadError(app)).toBe(app);
    const other = new Error("database exploded");
    expect(toUploadError(other)).toBe(other);
  });
});
