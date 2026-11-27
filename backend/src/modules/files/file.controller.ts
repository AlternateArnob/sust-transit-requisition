import type { Request, Response } from "express";
import { notFound } from "../../errors/AppError.js";
import { isValidStorageName, uploadRoot } from "../../services/fileStorage.js";
import * as fileService from "./file.service.js";

/** Streams a stored file after the access check (Part 1 §12.17). */
export async function download(req: Request, res: Response): Promise<void> {
  const file = await fileService.getReadableFile(String(req.params.id), req.user!);
  if (!isValidStorageName(file.storage_name)) throw notFound("File not found");

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
  if (file.mime_type.startsWith("image/")) {
    res.setHeader("Content-Disposition", "inline");
  } else {
    res.attachment(file.original_name);
  }
  res.type(file.mime_type);

  await new Promise<void>((resolve, reject) => {
    // `root` keeps send's dotfile check to the file name, not to the upload directory's path.
    res.sendFile(file.storage_name, { root: uploadRoot(), cacheControl: false }, (error) => {
      if (!error) return resolve();
      // The client went away mid-transfer: nothing more to send.
      if (res.headersSent) return resolve();
      const code = (error as NodeJS.ErrnoException).code;
      reject(code === "ENOENT" ? notFound("File not found") : error);
    });
  });
}
