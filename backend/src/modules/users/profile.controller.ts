import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import { AppError, validation } from "../../errors/AppError.js";
import { decodeImageDataUrl } from "../../services/fileStorage.js";
import type { ChangePasswordBody, UpdateProfileBody } from "./profile.schemas.js";
import { signatureJsonBody } from "./profile.schemas.js";
import * as profileService from "./profile.service.js";
import { toMeResponse } from "./user.mapper.js";

// Controllers only translate HTTP to service calls and back (Part 1 §5 layering rule).

export function getMe(req: Request, res: Response): void {
  // `authenticate` has just loaded this row from the database.
  res.json(toMeResponse(req.user!.record));
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const user = await profileService.updateProfile(req.user!.id, req.body as UpdateProfileBody);
  res.json(toMeResponse(user));
}

/** Reads the signature from either upload form; the service checks the bytes. */
function readSignatureUpload(req: Request): profileService.SignatureUpload {
  if (req.file) return { buffer: req.file.buffer, originalName: req.file.originalname };

  const parsed = signatureJsonBody.safeParse(req.body);
  if (!parsed.success) {
    throw validation([{ path: "file", message: "A signature image is required." }]);
  }
  const buffer = decodeImageDataUrl(parsed.data.signatureDataUrl);
  if (!buffer) {
    throw validation([
      {
        path: "signatureDataUrl",
        message: "Send a PNG or JPEG as a base64 data URL (data:image/png;base64,...).",
      },
    ]);
  }
  if (buffer.length > env.MAX_SIGNATURE_BYTES) {
    throw new AppError(413, "PAYLOAD_TOO_LARGE", "The signature image is too large.", {
      maxBytes: env.MAX_SIGNATURE_BYTES,
    });
  }
  return { buffer };
}

export async function uploadSignature(req: Request, res: Response): Promise<void> {
  res.json(await profileService.replaceSignature(req.user!.id, readSignatureUpload(req)));
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  await profileService.changePassword(req.user!.id, req.body as ChangePasswordBody);
  res.status(204).end();
}
